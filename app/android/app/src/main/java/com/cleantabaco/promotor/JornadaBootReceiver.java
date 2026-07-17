package com.cleantabaco.promotor;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

public class JornadaBootReceiver extends BroadcastReceiver {
    public static final String BOOT_COMPLETED = "android.intent.action.BOOT_COMPLETED";

    @Override public void onReceive(Context context, Intent intent) {
        if (Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction()) || Intent.ACTION_MY_PACKAGE_REPLACED.equals(intent.getAction())) {
            JornadaScheduler.scheduleFromStored(context);
        }
    }
}
