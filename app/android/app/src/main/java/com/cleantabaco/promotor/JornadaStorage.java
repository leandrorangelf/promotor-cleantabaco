package com.cleantabaco.promotor;

import android.content.Context;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteOpenHelper;

import java.util.ArrayList;
import java.util.List;

public class JornadaStorage extends SQLiteOpenHelper {
    private static final String DATABASE = "jornada.db";
    private static final int VERSION = 1;

    public static class Ponto {
        public String jornadaId, pontoId, capturadoEm;
        public double latitude, longitude;
        public Double precisao, altitude, velocidade, direcao;
    }

    public JornadaStorage(Context context) {
        super(context, DATABASE, null, VERSION);
    }

    @Override public void onCreate(SQLiteDatabase db) {
        db.execSQL("CREATE TABLE fila_pontos (jornada_id TEXT NOT NULL, ponto_id TEXT NOT NULL, latitude REAL NOT NULL, longitude REAL NOT NULL, precisao REAL, altitude REAL, velocidade REAL, direcao REAL, capturado_em TEXT NOT NULL, criado_em INTEGER NOT NULL, PRIMARY KEY (jornada_id, ponto_id))");
    }

    @Override public void onUpgrade(SQLiteDatabase db, int oldVersion, int newVersion) {}

    public synchronized void enfileirar(Ponto p) {
        SQLiteDatabase db = getWritableDatabase();
        db.execSQL("INSERT OR IGNORE INTO fila_pontos (jornada_id,ponto_id,latitude,longitude,precisao,altitude,velocidade,direcao,capturado_em,criado_em) VALUES (?,?,?,?,?,?,?,?,?,?)",
                new Object[]{p.jornadaId, p.pontoId, p.latitude, p.longitude, p.precisao, p.altitude, p.velocidade, p.direcao, p.capturadoEm, System.currentTimeMillis()});
    }

    public synchronized List<Ponto> listarLote(int limite) {
        List<Ponto> result = new ArrayList<>();
        Cursor cursor = getReadableDatabase().query("fila_pontos", null, null, null, null, null, "criado_em ASC", String.valueOf(Math.min(Math.max(limite, 1), 50)));
        try {
            while (cursor.moveToNext()) {
                Ponto p = new Ponto();
                p.jornadaId = cursor.getString(cursor.getColumnIndexOrThrow("jornada_id"));
                p.pontoId = cursor.getString(cursor.getColumnIndexOrThrow("ponto_id"));
                p.latitude = cursor.getDouble(cursor.getColumnIndexOrThrow("latitude"));
                p.longitude = cursor.getDouble(cursor.getColumnIndexOrThrow("longitude"));
                p.precisao = nullableDouble(cursor, "precisao");
                p.altitude = nullableDouble(cursor, "altitude");
                p.velocidade = nullableDouble(cursor, "velocidade");
                p.direcao = nullableDouble(cursor, "direcao");
                p.capturadoEm = cursor.getString(cursor.getColumnIndexOrThrow("capturado_em"));
                result.add(p);
            }
        } finally { cursor.close(); }
        return result;
    }

    public synchronized void removerConfirmados(List<Ponto> pontos) {
        SQLiteDatabase db = getWritableDatabase();
        db.beginTransaction();
        try {
            for (Ponto p : pontos) db.delete("fila_pontos", "jornada_id = ? AND ponto_id = ?", new String[]{p.jornadaId, p.pontoId});
            db.setTransactionSuccessful();
        } finally { db.endTransaction(); }
    }

    public synchronized int contarPendentes() {
        Cursor cursor = getReadableDatabase().rawQuery("SELECT COUNT(*) FROM fila_pontos", null);
        try { return cursor.moveToFirst() ? cursor.getInt(0) : 0; } finally { cursor.close(); }
    }

    public synchronized void removerMaisAntigosQue(long limiteMs) {
        getWritableDatabase().delete("fila_pontos", "criado_em < ?", new String[]{String.valueOf(System.currentTimeMillis() - limiteMs)});
    }

    private static Double nullableDouble(Cursor c, String column) {
        int index = c.getColumnIndexOrThrow(column);
        return c.isNull(index) ? null : c.getDouble(index);
    }
}
