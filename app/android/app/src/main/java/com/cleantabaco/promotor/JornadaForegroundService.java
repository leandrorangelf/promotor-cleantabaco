package com.cleantabaco.promotor;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.location.Location;
import android.os.IBinder;
import android.os.Looper;

import androidx.annotation.Nullable;
import androidx.core.app.ActivityCompat;
import androidx.core.app.NotificationCompat;
import androidx.core.app.ServiceCompat;

import com.google.android.gms.location.FusedLocationProviderClient;
import com.google.android.gms.location.LocationCallback;
import com.google.android.gms.location.LocationRequest;
import com.google.android.gms.location.LocationResult;
import com.google.android.gms.location.LocationServices;
import com.google.android.gms.location.Priority;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class JornadaForegroundService extends Service {
    public static final String ACTION_START = "com.cleantabaco.promotor.JORNADA_START";
    public static final String ACTION_STOP = "com.cleantabaco.promotor.JORNADA_STOP";
    public static final String ACTION_FLUSH = "com.cleantabaco.promotor.JORNADA_FLUSH";
    public static final String EXTRA_JORNADA_ID = "jornadaId";
    public static final String EXTRA_TOKEN = "token";
    public static final String EXTRA_API = "apiBase";
    private static final int NOTIFICATION_ID = 812;
    private static final String CHANNEL = "jornada-gps";

    private FusedLocationProviderClient locationClient;
    private JornadaStorage storage;
    private JornadaApiClient apiClient;
    private ExecutorService executor;
    private String jornadaId = "";

    private final LocationCallback callback = new LocationCallback() {
        @Override public void onLocationResult(LocationResult result) {
            if (result == null) return;
            for (Location location : result.getLocations()) guardar(location);
            flushAsync();
        }
    };

    @Override public void onCreate() {
        super.onCreate();
        locationClient = LocationServices.getFusedLocationProviderClient(this);
        storage = new JornadaStorage(this);
        executor = Executors.newSingleThreadExecutor();
        criarCanal();
    }

    @Override public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent == null ? ACTION_START : intent.getAction();
        if (ACTION_STOP.equals(action)) { parar(); return START_NOT_STICKY; }
        if (intent != null) {
            if (intent.hasExtra(EXTRA_JORNADA_ID)) jornadaId = intent.getStringExtra(EXTRA_JORNADA_ID);
            String token = intent.getStringExtra(EXTRA_TOKEN);
            if (token != null && !token.isEmpty()) JornadaSecureStore.saveToken(this, token);
            String api = intent.getStringExtra(EXTRA_API);
            if (api != null && !api.isEmpty()) getSharedPreferences("jornada_config", MODE_PRIVATE).edit().putString(EXTRA_API, api).apply();
        }
        if (ACTION_FLUSH.equals(action)) { flushAsync(); return START_STICKY; }
        iniciar();
        return START_STICKY;
    }

    private void iniciar() {
        startForeground(NOTIFICATION_ID, notificacao("Rastreamento de jornada ativo"));
        if (ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED
                && ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION) != PackageManager.PERMISSION_GRANTED) return;
        executor.execute(() -> {
            String token = JornadaSecureStore.readToken(this);
            String api = getSharedPreferences("jornada_config", MODE_PRIVATE).getString(EXTRA_API, "https://promotor-cleantabaco.vercel.app");
            apiClient = new JornadaApiClient(api, token);
            if (jornadaId == null || jornadaId.isEmpty()) jornadaId = apiClient.iniciarJornada(getPreferencesName());
            if (!jornadaId.isEmpty()) runOnMainThread(this::solicitarLocalizacao);
        });
    }

    private void solicitarLocalizacao() {
        if (ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED
                && ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION) != PackageManager.PERMISSION_GRANTED) return;
        LocationRequest request = new LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, 60000L)
                .setMinUpdateIntervalMillis(30000L).setMinUpdateDistanceMeters(50f).build();
        locationClient.requestLocationUpdates(request, callback, Looper.getMainLooper());
    }

    private String getPreferencesName() { return getSharedPreferences("jornada_config", MODE_PRIVATE).getString("dispositivoId", android.os.Build.MODEL); }
    private void runOnMainThread(Runnable action) { new android.os.Handler(Looper.getMainLooper()).post(action); }

    private void guardar(Location location) {
        if (jornadaId == null || jornadaId.isEmpty()) return;
        JornadaStorage.Ponto p = new JornadaStorage.Ponto();
        p.jornadaId = jornadaId; p.pontoId = UUID.randomUUID().toString();
        p.latitude = location.getLatitude(); p.longitude = location.getLongitude();
        p.precisao = location.hasAccuracy() ? (double) location.getAccuracy() : null;
        p.altitude = location.hasAltitude() ? location.getAltitude() : null;
        p.velocidade = location.hasSpeed() ? (double) location.getSpeed() : null;
        p.direcao = location.hasBearing() ? (double) location.getBearing() : null;
        p.capturadoEm = Instant.ofEpochMilli(location.getTime()).toString();
        storage.enfileirar(p);
    }

    private void flushAsync() {
        executor.execute(() -> {
            storage.removerMaisAntigosQue(24L * 60 * 60 * 1000);
            String token = JornadaSecureStore.readToken(this);
            String api = getSharedPreferences("jornada_config", MODE_PRIVATE).getString(EXTRA_API, "https://promotor-cleantabaco.vercel.app");
            if (token.isEmpty() || jornadaId.isEmpty()) return;
            apiClient = new JornadaApiClient(api, token);
            List<JornadaStorage.Ponto> lote = storage.listarLote(50);
            if (!lote.isEmpty() && apiClient.enviarPontos(jornadaId, lote)) storage.removerConfirmados(lote);
        });
    }

    private void parar() {
        locationClient.removeLocationUpdates(callback);
        flushAsync();
        stopForeground(STOP_FOREGROUND_REMOVE);
        stopSelf();
    }

    private void criarCanal() {
        NotificationChannel channel = new NotificationChannel(CHANNEL, "Jornada GPS", NotificationManager.IMPORTANCE_LOW);
        getSystemService(NotificationManager.class).createNotificationChannel(channel);
    }

    private Notification notificacao(String texto) {
        return new NotificationCompat.Builder(this, CHANNEL).setSmallIcon(com.cleantabaco.promotor.R.mipmap.ic_launcher)
                .setContentTitle("Cleantabaco").setContentText(texto).setOngoing(true).setCategory(NotificationCompat.CATEGORY_SERVICE).build();
    }

    @Override public void onDestroy() { if (locationClient != null) locationClient.removeLocationUpdates(callback); if (executor != null) executor.shutdownNow(); super.onDestroy(); }
    @Nullable @Override public IBinder onBind(Intent intent) { return null; }
}
