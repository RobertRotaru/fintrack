package com.fintrack.storage;

import java.util.Arrays;

/** Recognises an image by its first bytes, so a file can't claim to be a photo it isn't. */
public final class ImageSniff {
    /** Bytes needed to tell the supported formats apart. */
    public static final int HEADER_BYTES = 12;

    private ImageSniff() {}

    public static boolean matches(String contentType, byte[] b) {
        if (b == null) return false;
        return switch (contentType) {
            case "image/jpeg" -> b.length >= 3 && (b[0] & 0xff) == 0xff && (b[1] & 0xff) == 0xd8 && (b[2] & 0xff) == 0xff;
            case "image/png" -> b.length >= 8 && Arrays.equals(Arrays.copyOf(b, 8), new byte[] {(byte) 0x89, 'P', 'N', 'G', '\r', '\n', 0x1a, '\n'});
            case "image/webp" -> b.length >= 12 && b[0] == 'R' && b[1] == 'I' && b[2] == 'F' && b[3] == 'F' && b[8] == 'W' && b[9] == 'E' && b[10] == 'B' && b[11] == 'P';
            default -> false;
        };
    }

    public static String typeOfKey(String key) {
        if (key.endsWith(".webp")) return "image/webp";
        if (key.endsWith(".png")) return "image/png";
        return "image/jpeg";
    }
}
