package com.cleantabaco.promotor;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;

import java.time.DayOfWeek;
import java.time.ZoneId;
import java.time.ZonedDateTime;

public final class JornadaScheduler {
    public static final String ACTION_START = "com.cleantabaco.promotor.JORNADA_SCHEDULE_START";
    public static final String ACTION_STOP = "com.cleantabaco.promotor.JORNADA_SCHEDULE_STOP";
    public static final String TIME_ZONE = "America/Sao_Paulo";
    public static final String START_HOUR = "08";
    public static final String STOP_HOUR = "18";
    public static final String FIRST_WORK_DAY = "MONDAY";
    public static final String LAST_WORK_DAY = "FRIDAY";
    private static final int START_CODE = 801;
    private static final int STOP_CODE = 802;

    private JornadaScheduler() {}

    public static void schedule(Context context, String token, String apiBase, String dispositivoId) {
        JornadaSecureStore.saveToken(context, token);
        context.getSharedPreferences("jornada_config", Context.MODE_PRIVATE).edit()
                .putString(JornadaForegroundService.EXTRA_API, apiBase).putString("dispositivoId", dispositivoId).apply();
        AlarmManager alarms = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        agendar(alarms, context, ACTION_START, proximaOcorrencia(Integer.parseInt(START_HOUR)), START_CODE);
        agendar(alarms, context, ACTION_STOP, proximaOcorrencia(Integer.parseInt(STOP_HOUR)), STOP_CODE);
    }

    public static void scheduleFromStored(Context context) {
        String token = JornadaSecureStore.readToken(context);
        if (token.isEmpty()) return;
        String api = context.getSharedPreferences("jornada_config", Context.MODE_PRIVATE)
                .getString(JornadaForegroundService.EXTRA_API, "https://promotor-cleantabaco.vercel.app");
        String dispositivo = context.getSharedPreferences("jornada_config", Context.MODE_PRIVATE).getString("dispositivoId", android.os.Build.MODEL);
        schedule(context, token, api, dispositivo);
        ZonedDateTime agora = ZonedDateTime.now(ZoneId.of(TIME_ZONE));
        if (diaUtil(agora) && agora.getHour() >= 8 && agora.getHour() < 18) iniciarAgora(context);
    }

    public static void iniciarAgora(Context context) {
        Intent intent = new Intent(context, JornadaForegroundService.class).setAction(JornadaForegroundService.ACTION_START);
        androidx.core.content.ContextCompat.startForegroundService(context, intent);
    }

    public static void pararAgora(Context context) {
        context.startService(new Intent(context, JornadaForegroundService.class).setAction(JornadaForegroundService.ACTION_STOP));
    }

    private static void agendar(AlarmManager alarms, Context context, String action, ZonedDateTime quando, int code) {
        Intent intent = new Intent(context, JornadaAlarmReceiver.class).setAction(action);
        PendingIntent pending = PendingIntent.getBroadcast(context, code, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, quando.toInstant().toEpochMilli(), pending);
    }

    static ZonedDateTime proximaOcorrencia(int hora) {
        ZoneId zone = ZoneId.of(TIME_ZONE); ZonedDateTime agora = ZonedDateTime.now(zone);
        ZonedDateTime candidata = agora.withHour(hora).withMinute(0).withSecond(0).withNano(0);
        if (!candidata.isAfter(agora)) candidata = candidata.plusDays(1);
        while (!diaUtil(candidata)) candidata = candidata.plusDays(1);
        return candidata;
    }

    static boolean diaUtil(ZonedDateTime data) {
        return data.getDayOfWeek() != DayOfWeek.SATURDAY && data.getDayOfWeek() != DayOfWeek.SUNDAY;
    }
}
