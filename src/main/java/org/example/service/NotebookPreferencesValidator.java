package org.example.service;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.*;

/** Bounded, versioned presentation data; never interpreted as HTML, CSS or business rules. */
public final class NotebookPreferencesValidator {
    private NotebookPreferencesValidator() {}

    public static void validate(JsonNode value) {
        require(value != null && value.isObject() && value.toString().length() <= 100000);
        fields(value, "version", "page", "rules");
        integer(value, "version", 1, 1);
        JsonNode page = value.path("page");
        fields(page, "format", "orientation", "marginMm", "rowsPerPage", "fontPt", "separators", "alignment");
        choice(page, "format", "A4", "A5");
        choice(page, "orientation", "portrait", "landscape");
        if (page.has("alignment")) choice(page, "alignment", "left", "center", "right");
        integer(page, "marginMm", 5, 30);
        integer(page, "rowsPerPage", 1, 24);
        integer(page, "fontPt", 12, 48);
        require(page.path("separators").isBoolean());
        JsonNode rules = value.path("rules");
        require(rules.isArray() && rules.size() <= 250);
        Set<String> matches = new HashSet<>();
        for (JsonNode rule : rules) {
            fields(rule, "match", "display", "meaning", "role", "attach", "position", "size", "bold", "underline", "highlight");
            String match = text(rule, "match", 40);
            require(match.equals(match.trim()) && !match.contains("\n") && !match.contains("\r") && matches.add(match));
            text(rule, "display", 64);
            require(rule.path("meaning").isTextual() && rule.path("meaning").asText().length() <= 200);
            choice(rule, "role", "main", "modifier", "standalone");
            choice(rule, "attach", "previous", "next", "standalone");
            choice(rule, "position", "top-left", "top-center", "top-right", "middle-left", "center", "middle-right", "bottom-left", "bottom-center", "bottom-right");
            integer(rule, "size", 50, 150);
            for (String flag : Arrays.asList("bold", "underline", "highlight")) require(rule.path(flag).isBoolean());
        }
    }

    private static void fields(JsonNode value, String... allowed) {
        require(value.isObject());
        value.fieldNames().forEachRemaining(name -> require(Arrays.asList(allowed).contains(name)));
    }

    private static String text(JsonNode node, String key, int max) {
        JsonNode item = node.path(key);
        require(item.isTextual() && !item.asText().trim().isEmpty() && item.asText().length() <= max
                && item.asText().chars().noneMatch(c -> c < 32));
        return item.asText();
    }

    private static void choice(JsonNode node, String key, String... options) {
        require(node.path(key).isTextual() && Arrays.asList(options).contains(node.path(key).asText()));
    }

    private static void integer(JsonNode node, String key, int min, int max) {
        JsonNode item = node.path(key);
        require(item.isIntegralNumber() && item.canConvertToInt() && item.asInt() >= min && item.asInt() <= max);
    }

    private static void require(boolean condition) {
        if (!condition) throw new IllegalArgumentException("Modelo inválido. Verifica símbolos únicos, posições, tamanhos e configuração da página.");
    }
}
