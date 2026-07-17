package com.cleantabaco.promotor;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

public class JornadaAlarmReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context context, Intent intent) {
        if (JornadaScheduler.ACTION_START.equals(intent.getAction())) {
            JornadaScheduler.scheduleFromStored(context);
            JornadaScheduler.iniciarAgora(context);
        } else if (JornadaScheduler.ACTION_STOP.equals(intent.getAction())) {
            JornadaScheduler.pararAgora(context);
            JornadaScheduler.scheduleFromStored(context);
        }
    }
}
