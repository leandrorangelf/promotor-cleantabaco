package com.cleantabaco.promotor;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.PackageInfo;
import android.net.Uri;
import android.provider.Settings;

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
        boolean ativa = getContext().getSharedPreferences("jornada_config", 0).getBoolean("jornada_ativa", false);
        result.put("status", !location || !background ? "permissao_ausente" : (ativa ? "ativo" : "pronto"));
        result.put("permissaoLocalizacao", location); result.put("permissaoSegundoPlano", background);
        result.put("pendentes", new JornadaStorage(getContext()).contarPendentes());
        result.put("jornadaId", getContext().getSharedPreferences("jornada_config", 0).getString(JornadaForegroundService.EXTRA_JORNADA_ID, ""));
        try {
            PackageInfo info = getContext().getPackageManager().getPackageInfo(getContext().getPackageName(), 0);
            result.put("versaoNome", info.versionName == null ? "" : info.versionName);
            result.put("versaoCodigo", android.os.Build.VERSION.SDK_INT >= 28 ? info.getLongVersionCode() : info.versionCode);
        } catch (PackageManager.NameNotFoundException ignored) {
            result.put("versaoNome", ""); result.put("versaoCodigo", 0);
        }
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
    public void openSettings(PluginCall call) {
        Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
        intent.setData(Uri.fromParts("package", getContext().getPackageName(), null));
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(intent);
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
