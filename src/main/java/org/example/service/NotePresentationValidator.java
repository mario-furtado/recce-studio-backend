package org.example.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.*;

/** An allowlist of data values, never CSS/HTML. Applied before modifying persisted notes. */
public final class NotePresentationValidator {
    private static final ObjectMapper JSON = new ObjectMapper().enable(com.fasterxml.jackson.databind.DeserializationFeature.FAIL_ON_TRAILING_TOKENS);
    private NotePresentationValidator() {}

    public static String validate(String raw, String text) {
        if (raw == null) return null;
        require(raw.length() <= 30000);
        final JsonNode root;
        try { root = JSON.readTree(raw); }
        catch (Exception e) { throw new IllegalArgumentException("Apresentação da nota inválida."); }
        fields(root, "version", "text", "elements");
        integer(root.path("version"), 1, 1);
        require(root.path("text").isTextual() && Objects.equals(text, root.path("text").asText()) && text.length() <= 10000);
        JsonNode elements = root.path("elements");
        require(elements.isArray() && elements.size() <= 250);
        Set<String> keys = new HashSet<>();
        for (JsonNode element : elements) {
            fields(element, "match", "occurrence", "position", "size", "bold", "underline", "highlight");
            require(element.path("match").isTextual());
            String match = element.path("match").asText();
            require(!match.trim().isEmpty() && match.length() <= 200 && match.chars().noneMatch(c -> c < 32));
            integer(element.path("occurrence"), 0, 249);
            require(keys.add(match + "\n" + element.path("occurrence").asInt()));
            require(element.path("position").isTextual() && Arrays.asList("top-left", "top-center", "top-right", "middle-left", "center", "middle-right", "bottom-left", "bottom-center", "bottom-right").contains(element.path("position").asText()));
            integer(element.path("size"), 50, 150);
            for (String flag : Arrays.asList("bold", "underline", "highlight")) require(element.path(flag).isBoolean());
        }
        return elements.size() == 0 ? null : raw;
    }

    private static void fields(JsonNode value, String... allowed) {
        require(value != null && value.isObject());
        value.fieldNames().forEachRemaining(key -> require(Arrays.asList(allowed).contains(key)));
    }
    private static void integer(JsonNode value, int min, int max) {
        require(value.isIntegralNumber() && value.canConvertToInt() && value.asInt() >= min && value.asInt() <= max);
    }
    private static void require(boolean valid) {
        if (!valid) throw new IllegalArgumentException("Apresentação da nota inválida. Verifica posições, tamanhos e texto de origem.");
    }
}
