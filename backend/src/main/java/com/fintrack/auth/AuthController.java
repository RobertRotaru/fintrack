package com.fintrack.auth;

import com.fintrack.data.Views;
import com.fintrack.data.Visibility;
import com.fintrack.reference.ReferenceData;
import com.fintrack.web.ApiException;
import com.fintrack.web.Body;
import jakarta.servlet.http.HttpServletRequest;
import java.util.UUID;
import java.util.regex.Pattern;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    static final int BIO_MAX = 280;
    private static final Pattern EMAIL = Pattern.compile("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$");

    private final AuthService auth;
    private final Visibility view;
    private final ReferenceData ref;

    public AuthController(AuthService auth, Visibility view, ReferenceData ref) {
        this.auth = auth;
        this.view = view;
        this.ref = ref;
    }

    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    public AuthService.Session register(Body b) {
        String email = b.str("email", "Email", 200).toLowerCase();
        if (!EMAIL.matcher(email).matches()) throw ApiException.bad("Enter a valid email");
        String name = b.str("name", "Name", 80);
        String password = b.str("password", "Password", 200);
        if (password.length() < 8) throw ApiException.bad("Password must be at least 8 characters");
        String country = b.oneOfOr("country", "RO", "Country", ref.countryCodes());
        String fallbackCurrency = ref.country(country).orElseThrow().currency();
        String currency = b.oneOfOr("baseCurrency", fallbackCurrency, "Currency", ref.currencyCodes());
        return auth.register(email, name, password, country, currency);
    }

    @PostMapping("/login")
    public AuthService.Session login(Body b, HttpServletRequest request) {
        String email = b.str("email", "Email", 200).toLowerCase();
        String password = b.str("password", "Password", 200);
        return auth.login(email, password, request.getRemoteAddr());
    }

    @GetMapping("/me")
    public Views.User me(@AuthenticationPrincipal UUID me) {
        return view.user(me).orElseThrow(() -> ApiException.unauthorized("Account no longer exists"));
    }

    @PatchMapping("/me")
    public Views.User update(@AuthenticationPrincipal UUID me, Body b) {
        // Validate every field first so a bad one doesn't leave the others half-saved.
        String name = b.has("name") ? b.str("name", "Name", 80) : null;
        String bio = b.has("bio") ? b.optStr("bio", "Bio", BIO_MAX) : null;
        String country = b.has("country") ? b.oneOf("country", "Country", ref.countryCodes()) : null;
        String currency = b.has("baseCurrency") ? b.oneOf("baseCurrency", "Currency", ref.currencyCodes()) : null;
        return auth.update(me, name, bio, country, currency);
    }
}
