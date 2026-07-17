package com.cleantabaco.promotor;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.List;

public class JornadaApiClient {
    private final String baseUrl;
    private final String token;

    public JornadaApiClient(String baseUrl, String token) {
        this.baseUrl = baseUrl.replaceAll("/$", "");
        this.token = token;
    }

    public boolean enviarPontos(String jornadaId, List<JornadaStorage.Ponto> pontos) {
        HttpURLConnection connection = null;
        try {
            JSONObject body = new JSONObject().put("jornadaId", Long.parseLong(jornadaId));
            JSONArray array = new JSONArray();
            for (JornadaStorage.Ponto p : pontos) {
                JSONObject item = new JSONObject().put("pontoId", p.pontoId)
                        .put("latitude", p.latitude).put("longitude", p.longitude)
                        .put("capturadoEm", p.capturadoEm);
                putNullable(item, "precisao", p.precisao); putNullable(item, "altitude", p.altitude);
                putNullable(item, "velocidade", p.velocidade); putNullable(item, "direcao", p.direcao);
                array.put(item);
            }
            body.put("pontos", array);
            connection = abrir("/api/jornada-pontos", "POST");
            try (OutputStream output = connection.getOutputStream()) { output.write(body.toString().getBytes(StandardCharsets.UTF_8)); }
            int code = connection.getResponseCode();
            return code >= 200 && code < 300;
        } catch (Exception ignored) { return false; }
        finally { if (connection != null) connection.disconnect(); }
    }

    private HttpURLConnection abrir(String path, String method) throws Exception {
        HttpURLConnection connection = (HttpURLConnection) new URL(baseUrl + path).openConnection();
        connection.setRequestMethod(method); connection.setConnectTimeout(15000); connection.setReadTimeout(15000);
        connection.setDoOutput(true); connection.setRequestProperty("Content-Type", "application/json");
        connection.setRequestProperty("Authorization", "Bearer " + token); return connection;
    }

    private static void putNullable(JSONObject object, String key, Double value) throws Exception { if (value != null) object.put(key, value); }
}
