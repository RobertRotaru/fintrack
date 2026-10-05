package com.fintrack.web;

import static com.fintrack.web.ApiException.bad;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.DateTimeException;
import java.time.LocalDate;
import java.util.Collection;
import java.util.regex.Pattern;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.node.JsonNodeFactory;
import tools.jackson.databind.node.ObjectNode;

/**
 * A parsed JSON request body with the API's validators. A missing body, a
 * non-JSON body or a JSON value that isn't an object all behave like `{}`.
 *
 * "Present" follows the JavaScript API this replaced: a field set to null is
 * present (so `{"name": null}` fails validation), a missing field is not.
 */
public final class Body {
    /** Largest absolute amount accepted anywhere (balances, transactions, goals). */
    public static final BigDecimal MAX_AMOUNT = new BigDecimal("1000000000000");

    private static final Pattern DECIMAL = Pattern.compile("^-?\\d+(\\.\\d+)?$");
    private static final Pattern ISO_DATE = Pattern.compile("^\\d{4}-\\d{2}-\\d{2}$");
    private static final Pattern HEX = Pattern.compile("^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$");
    private static final Pattern ICON = Pattern.compile("^[a-z0-9]+(-[a-z0-9]+)*$");
    private static final int MAX_IMAGE = 400_000;

    private final ObjectNode node;

    public Body(ObjectNode node) {
        this.node = node;
    }

    public static Body empty() {
        return new Body(JsonNodeFactory.instance.objectNode());
    }

    public static Body of(JsonNode node) {
        return node instanceof ObjectNode o ? new Body(o) : empty();
    }

    /** The field, or null when absent. JSON null is returned as a NullNode. */
    public JsonNode get(String field) {
        return node.get(field);
    }

    public boolean has(String field) {
        return node.has(field);
    }

    /** JavaScript truthiness: false for missing, null, false, 0, "" — true otherwise. */
    public boolean truthy(String field) {
        return truthy(node.get(field));
    }

    /** True when the field is missing or null — where the old API used `??` defaults. */
    public boolean nullish(String field) {
        return isNullish(node.get(field));
    }

    public static boolean isNullish(JsonNode v) {
        return v == null || v.isNull() || v.isMissingNode();
    }

    public static boolean truthy(JsonNode v) {
        if (isNullish(v)) return false;
        if (v.isBoolean()) return v.booleanValue();
        if (v.isNumber()) return v.decimalValue().signum() != 0;
        if (v.isString()) return !v.stringValue().isEmpty();
        return true;
    }

    // --- text --------------------------------------------------------------

    public String str(String field, String label, int max) {
        return str(node.get(field), label, max, false);
    }

    public String optStr(String field, String label, int max) {
        return str(node.get(field), label, max, true);
    }

    /** Text, trimmed; whitespace-only counts as missing. Empty string when optional and missing. */
    public static String str(JsonNode v, String label, int max, boolean optional) {
        if (!isNullish(v) && !v.isString()) throw bad(label + " must be text");
        String s = isNullish(v) ? "" : v.stringValue().strip();
        if (s.isEmpty()) {
            if (optional) return "";
            throw bad(label + " is required");
        }
        if (max > 0 && s.length() > max) throw bad(label + " is too long");
        return s;
    }

    /** Optional note-style text: null when blank. */
    public String note(String field, int max) {
        String s = optStr(field, "Note", max);
        return s.isEmpty() ? null : s;
    }

    // --- numbers -----------------------------------------------------------

    public record NumRule(BigDecimal min, BigDecimal max, int decimals) {
        public static NumRule decimals(int decimals) {
            return new NumRule(null, null, decimals);
        }

        public NumRule min(BigDecimal min) {
            return new NumRule(min, max, decimals);
        }
    }

    public BigDecimal num(String field, String label, NumRule rule) {
        return num(node.get(field), label, rule, false);
    }

    /** Null when the field is missing, null or blank. */
    public BigDecimal optNum(String field, String label, NumRule rule) {
        return num(node.get(field), label, rule, true);
    }

    /**
     * A number, or a plain decimal string ("12.5") — never a boolean, hex or
     * exponent string. Range-checked, then rounded half away from zero.
     */
    public static BigDecimal num(JsonNode v, String label, NumRule rule, boolean optional) {
        if (isNullish(v) || (v.isString() && v.stringValue().isBlank())) {
            if (optional) return null;
            throw bad(label + " is required");
        }
        BigDecimal n;
        if (v.isNumber()) n = v.decimalValue();
        else if (v.isString() && DECIMAL.matcher(v.stringValue().strip()).matches()) n = new BigDecimal(v.stringValue().strip());
        else throw bad(label + " must be a number");
        if (rule.min() != null && n.compareTo(rule.min()) < 0) throw bad(label + " must be at least " + plain(rule.min()));
        BigDecimal max = rule.max() != null ? rule.max() : MAX_AMOUNT;
        if (n.compareTo(max) > 0) throw bad(label + " is too large");
        if (n.compareTo(MAX_AMOUNT.negate()) < 0) throw bad(label + " is too small");
        return n.setScale(rule.decimals(), RoundingMode.HALF_UP);
    }

    private static String plain(BigDecimal d) {
        return d.stripTrailingZeros().toPlainString();
    }

    // --- choices, dates, colours, icons, images ----------------------------

    public String oneOf(String field, String label, Collection<String> values) {
        return oneOf(node.get(field), label, values);
    }

    /** `field ?? fallback`, then one of the allowed values. */
    public String oneOfOr(String field, String fallback, String label, Collection<String> values) {
        JsonNode v = node.get(field);
        return isNullish(v) ? oneOfValue(fallback, label, values) : oneOf(v, label, values);
    }

    public static String oneOf(JsonNode v, String label, Collection<String> values) {
        if (v != null && v.isString() && values.contains(v.stringValue())) return v.stringValue();
        throw bad(label + " must be one of " + String.join(", ", values));
    }

    public static String oneOfValue(String v, String label, Collection<String> values) {
        if (v != null && values.contains(v)) return v;
        throw bad(label + " must be one of " + String.join(", ", values));
    }

    public LocalDate date(String field, String label) {
        return isoDate(node.get(field), label);
    }

    /** A real calendar date (rejects 2026-02-30) between 1970 and 2100. */
    public static LocalDate isoDate(JsonNode v, String label) {
        return isoDate(str(v, label, 0, false), label);
    }

    public static LocalDate isoDate(String s, String label) {
        if (!ISO_DATE.matcher(s).matches()) throw bad(label + " must be yyyy-MM-dd");
        int y = Integer.parseInt(s.substring(0, 4));
        int m = Integer.parseInt(s.substring(5, 7));
        int d = Integer.parseInt(s.substring(8, 10));
        LocalDate date;
        try {
            date = LocalDate.of(y, m, d);
        } catch (DateTimeException e) {
            throw bad(label + " is not a real date");
        }
        if (y < 1970 || y > 2100) throw bad(label + " must be between 1970 and 2100");
        return date;
    }

    public String hexColor(String field) {
        return hexColor(node.get(field));
    }

    /** #rgb or #rrggbb — colours end up in inline styles, so nothing else gets through. */
    public static String hexColor(JsonNode v) {
        String s = str(v, "Colour", 7, false);
        if (!HEX.matcher(s).matches()) throw bad("Colour must be a hex colour like #6366f1");
        return s.toLowerCase();
    }

    public static String hexColorValue(String v) {
        return hexColor(JsonNodeFactory.instance.stringNode(v));
    }

    public String iconName(String field) {
        return iconName(node.get(field));
    }

    /** Icon names are kebab-case identifiers from the client's icon set. */
    public static String iconName(JsonNode v) {
        String s = str(v, "Icon", 40, false);
        if (!ICON.matcher(s).matches()) throw bad("Icon must be an icon name");
        return s;
    }

    public static String iconNameValue(String v) {
        return iconName(JsonNodeFactory.instance.stringNode(v));
    }

    /** Optional data-URL image, capped so a phone photo can't bloat the database. */
    public String image(String field) {
        JsonNode v = node.get(field);
        if (!truthy(v)) return null;
        if (!v.isString() || !v.stringValue().startsWith("data:image/")) throw bad("image must be a data URL");
        if (v.stringValue().length() > MAX_IMAGE) throw bad("image is too large");
        return v.stringValue();
    }
}
