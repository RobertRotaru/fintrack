package com.fintrack.web;

import java.util.UUID;

/** Ids arrive as untrusted text; anything that isn't a UUID simply matches nothing. */
public final class Ids {
    private Ids() {}

    public static UUID parse(String s) {
        if (s == null || s.length() != 36) return null;
        try {
            return UUID.fromString(s);
        } catch (IllegalArgumentException e) {
            return null;
        }
    }
}
