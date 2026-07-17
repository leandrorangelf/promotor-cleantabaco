package com.cleantabaco.promotor;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "Jornada")
public class JornadaPlugin extends Plugin {
    @PluginMethod
    public void getStatus(PluginCall call) {
        JSObject result = new JSObject();
        boolean location = ContextCompat.checkSelfPermission(getContext(), Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED;
        boolean background = ContextCompat.checkSelfPermission(getContext(), Manifest.permission.ACCESS_BACKGROUND_LOCATION) == PackageManager.PERMISSION_GRANTED;
        result.put("status", location && background ? "pronto" : "permissao_ausente");
        result.put("permissaoLocalizacao", location); result.put("permissaoSegundoPlano", background);
        result.put("pendentes", new JornadaStorage(getContext()).contarPendentes());
        result.put("jornadaId", getContext().getSharedPreferences("jornada_config", 0).getString(JornadaForegroundService.EXTRA_JORNADA_ID, ""));
        call.resolve(result);
    }

    @PluginMethod
    public void start(PluginCall call) {
        String token = call.getString("token", "");
        String api = call.getString("apiBase", "https://promotor-cleantabaco.vercel.app");
        String jornadaId = call.getString("jornadaId", "");
        if (!token.isEmpty()) JornadaSecureStore.saveToken(getContext(), token);
        getContext().getSharedPreferences("jornada_config", 0).edit().putString(JornadaForegroundService.EXTRA_JORNADA_ID, jornadaId).putString(JornadaForegroundService.EXTRA_API, api).apply();
        Intent intent = new Intent(getContext(), JornadaForegroundService.class).setAction(JornadaForegroundService.ACTION_START)
                .putExtra(JornadaForegroundService.EXTRA_TOKEN, token).putExtra(JornadaForegroundService.EXTRA_API, api).putExtra(JornadaForegroundService.EXTRA_JORNADA_ID, jornadaId);
        ContextCompat.startForegroundService(getContext(), intent);
        call.resolve();
    }

    @PluginMethod
    public void stop(PluginCall call) {
        getContext().startService(new Intent(getContext(), JornadaForegroundService.class).setAction(JornadaForegroundService.ACTION_STOP));
        call.resolve();
    }

    @PluginMethod
    public void flush(PluginCall call) {
        getContext().startService(new Intent(getContext(), JornadaForegroundService.class).setAction(JornadaForegroundService.ACTION_FLUSH));
        call.resolve();
    }

    @PluginMethod
    public void schedule(PluginCall call) {
        String token = call.getString("token", "");
        String api = call.getString("apiBase", "https://promotor-cleantabaco.vercel.app");
        String dispositivoId = call.getString("dispositivoId", android.os.Build.MODEL);
        JornadaScheduler.schedule(getContext(), token, api, dispositivoId);
        call.resolve();
    }
}
