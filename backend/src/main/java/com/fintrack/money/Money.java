package com.fintrack.money;

import java.math.BigDecimal;
import java.math.RoundingMode;

/** Rounding that matches @ft/core: half away from zero, at the currency's precision. */
public final class Money {
    private Money() {}

    public static BigDecimal round(BigDecimal n, int decimals) {
        return n.setScale(decimals, RoundingMode.HALF_UP);
    }

    /**
     * Rounds a double the way JavaScript's roundTo does: via its shortest
     * decimal representation, so 1.005 becomes 1.01 rather than 1.00.
     */
    public static BigDecimal round(double n, int decimals) {
        if (!Double.isFinite(n)) throw new IllegalArgumentException("not a finite number: " + n);
        return BigDecimal.valueOf(n).setScale(decimals, RoundingMode.HALF_UP);
    }

    public static double round2(double n) {
        return Double.isFinite(n) ? round(n, 2).doubleValue() : n;
    }
}
