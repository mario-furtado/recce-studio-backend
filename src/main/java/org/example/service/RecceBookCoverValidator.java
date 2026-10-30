package org.example.service;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.Arrays;

/** Strict data-only cover schema; branding is supplied by the application. */
public final class RecceBookCoverValidator {
    private RecceBookCoverValidator() {}
    public static void validate(JsonNode value) {
        require(value != null && value.toString().length() <= 50000);
        fields(value, "version", "front", "back");
        require(value.path("version").isIntegralNumber() && value.path("version").canConvertToInt() && value.path("version").asInt() == 1);
        for (String side : Arrays.asList("front", "back")) {
            JsonNode page = value.path(side);
            fields(page, "background", "elements"); color(page.path("background"));
            JsonNode elements = page.path("elements"); require(elements.isArray() && elements.size() <= 12);
            for (JsonNode item : elements) {
                fields(item, "text", "x", "y", "width", "fontPt", "font", "align", "bold", "italic", "underline", "color");
                require(item.path("text").isTextual() && item.path("text").asText().length() <= 1000);
                require(item.path("text").asText().chars().noneMatch(c -> c < 32 && c != 9 && c != 10 && c != 13));
                number(item.path("x"), 0, 95); number(item.path("y"), 0, 95);
                number(item.path("width"), 5, 100); number(item.path("fontPt"), 8, 72);
                require(item.path("x").asDouble() + item.path("width").asDouble() <= 100);
                require(item.path("font").isTextual() && Arrays.asList("Arial", "Georgia", "Courier New").contains(item.path("font").asText()));
                require(item.path("align").isTextual() && Arrays.asList("left", "center", "right").contains(item.path("align").asText()));
                for (String flag : Arrays.asList("bold", "italic", "underline")) require(item.path(flag).isBoolean());
                color(item.path("color"));
            }
        }
    }
    private static void fields(JsonNode value, String... allowed) {
        require(value != null && value.isObject());
        value.fieldNames().forEachRemaining(key -> require(Arrays.asList(allowed).contains(key)));
    }
    private static void color(JsonNode value) { require(value.isTextual() && value.asText().matches("#[0-9a-fA-F]{6}")); }
    private static void number(JsonNode value, double min, double max) {
        require(value.isNumber() && Double.isFinite(value.asDouble()) && value.asDouble() >= min && value.asDouble() <= max);
    }
    private static void require(boolean valid) {
        if (!valid) throw new IllegalArgumentException("Capa inválida. Verifica textos, posições, tamanhos e cores; a marca não é editável.");
    }
}
