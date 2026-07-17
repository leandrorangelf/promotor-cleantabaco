package com.cleantabaco.promotor;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Base64;

import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.security.SecureRandom;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

public final class JornadaSecureStore {
    private static final String KEY_ALIAS = "cleantabaco-jornada-token";
    private static final String PREFS = "jornada_secure";
    private static final String TOKEN = "token";

    private JornadaSecureStore() {}

    public static void saveToken(Context context, String token) {
        if (token == null || token.isEmpty()) return;
        try {
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, getKey());
            byte[] encrypted = cipher.doFinal(token.getBytes(StandardCharsets.UTF_8));
            String value = Base64.encodeToString(cipher.getIV(), Base64.NO_WRAP) + ":" +
                    Base64.encodeToString(encrypted, Base64.NO_WRAP);
            prefs(context).edit().putString(TOKEN, value).apply();
        } catch (Exception ignored) {}
    }

    public static String readToken(Context context) {
        String value = prefs(context).getString(TOKEN, "");
        if (value == null || !value.contains(":")) return "";
        try {
            String[] parts = value.split(":", 2);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, getKey(), new GCMParameterSpec(128, Base64.decode(parts[0], Base64.NO_WRAP)));
            return new String(cipher.doFinal(Base64.decode(parts[1], Base64.NO_WRAP)), StandardCharsets.UTF_8);
        } catch (Exception ignored) {
            return "";
        }
    }

    private static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    private static SecretKey getKey() throws Exception {
        KeyStore keyStore = KeyStore.getInstance("AndroidKeyStore");
        keyStore.load(null);
        if (keyStore.containsAlias(KEY_ALIAS)) return ((KeyStore.SecretKeyEntry) keyStore.getEntry(KEY_ALIAS, null)).getSecretKey();
        KeyGenerator generator = KeyGenerator.getInstance("AES", "AndroidKeyStore");
        generator.init(256);
        generator.generateKey();
        return ((KeyStore.SecretKeyEntry) keyStore.getEntry(KEY_ALIAS, null)).getSecretKey();
    }
}
