package com.fintrack.api;

import static com.fintrack.web.ApiException.bad;
import static com.fintrack.web.ApiException.forbidden;
import static com.fintrack.web.ApiException.notFound;

import com.fintrack.data.Views;
import com.fintrack.data.Visibility;
import com.fintrack.reference.ReferenceData;
import com.fintrack.web.ApiException;
import com.fintrack.web.Body;
import com.fintrack.web.Body.NumRule;
import com.fintrack.web.Ids;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/accounts")
public class AccountController {
    static final List<String> TYPES = List.of("debit", "credit", "savings", "loan", "investment", "crypto", "cash");

    private final JdbcClient db;
    private final Visibility view;
    private final ReferenceData ref;

    public AccountController(JdbcClient db, Visibility view, ReferenceData ref) {
        this.db = db;
        this.view = view;
        this.ref = ref;
    }

    @GetMapping
    public List<Views.Account> list(@AuthenticationPrincipal UUID me) {
        return view.visibleAccounts(me);
    }

    private UUID sharedHousehold(UUID me, boolean shared) {
        if (!shared) return null;
        UUID hh = view.householdIdOf(me);
        if (hh == null) throw forbidden("Join or create a family first to share accounts");
        return hh;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Views.Account create(@AuthenticationPrincipal UUID me, Body b) {
        String institutionId = b.truthy("institutionId") ? b.str("institutionId", "Institution", 60) : null;
        var inst = ref.findInstitution(institutionId);
        if (institutionId != null && inst.isEmpty()) throw bad("Unknown bank or provider");
        String type = b.oneOf("type", "Type", TYPES);
        String currency = b.oneOf("currency", "Currency", ref.currencyCodes());
        BigDecimal limit = b.optNum("creditLimit", "Credit limit", NumRule.decimals(2).min(BigDecimal.ZERO));
        UUID id = UUID.randomUUID();
        UUID household = sharedHousehold(me, b.truthy("shared"));
        String name = b.str("name", "Name", 60);
        String institutionName = inst.map(ReferenceData.Institution::name).orElseGet(() -> {
            String typed = b.optStr("institutionName", "Institution", 80);
            return typed.isEmpty() ? null : typed;
        });
        String country = b.oneOf("country", "Country", ref.countryCodes());
        String color = b.hexColor("color");
        String icon = b.iconName("icon");
        String image = b.image("image");
        BigDecimal opening = b.nullish("initialBalance")
                ? BigDecimal.ZERO
                : b.num("initialBalance", "Opening balance", NumRule.decimals(ref.decimalsFor(currency)));
        db.sql("""
                INSERT INTO accounts (id, owner_id, household_id, type, name, institution_id, institution_name, country, currency,
                  color, icon, image, initial_balance, credit_limit) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""")
                .params(id, me, household, type, name, institutionId, institutionName, country, currency, color, icon, image, opening,
                        "credit".equals(type) ? limit : null)
                .update();
        return find(me, id);
    }

    private Views.Account find(UUID me, UUID id) {
        return view.visibleAccounts(me).stream().filter(a -> a.id().equals(id)).findFirst().orElseThrow();
    }

    private Views.Account owned(UUID me, String rawId, String action) {
        Views.Account acc = view.visibleAccount(me, Ids.parse(rawId)).orElseThrow(() -> notFound("Account not found"));
        if (!acc.ownerId().equals(me)) throw forbidden("Only the owner can " + action + " this account");
        return acc;
    }

    @PatchMapping("/{id}")
    public Views.Account update(@AuthenticationPrincipal UUID me, @PathVariable String id, Body b) {
        Views.Account acc = owned(me, id, "edit");
        Map<String, Object> sets = new LinkedHashMap<>();
        if (b.has("name")) sets.put("name", b.str("name", "Name", 60));
        if (b.has("color")) sets.put("color", b.hexColor("color"));
        if (b.has("icon")) sets.put("icon", b.iconName("icon"));
        if (b.has("image")) sets.put("image", b.image("image"));
        if (b.has("initialBalance")) sets.put("initial_balance", b.num("initialBalance", "Opening balance", NumRule.decimals(ref.decimalsFor(acc.currency()))));
        if (b.has("creditLimit")) {
            sets.put("credit_limit", b.get("creditLimit").isNull() ? null : b.num("creditLimit", "Credit limit", NumRule.decimals(2).min(BigDecimal.ZERO)));
        }
        if (b.has("archived")) sets.put("archived", b.truthy("archived"));
        if (b.has("shared")) sets.put("household_id", sharedHousehold(me, b.truthy("shared")));
        if (!sets.isEmpty()) {
            List<Object> params = new ArrayList<>(sets.values());
            params.add(acc.id());
            String assignments = String.join(", ", sets.keySet().stream().map(c -> c + " = ?").toList());
            db.sql("UPDATE accounts SET " + assignments + " WHERE id = ?").params(params).update();
        }
        return find(me, acc.id());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@AuthenticationPrincipal UUID me, @PathVariable String id) {
        Views.Account acc = owned(me, id, "delete");
        // Deleting transfers would silently change the other account's balance.
        long transfers = db.sql("SELECT COUNT(*) FROM transfers WHERE from_account_id = ? OR to_account_id = ?").params(acc.id(), acc.id()).query(Long.class).single();
        if (transfers > 0) {
            throw new ApiException(HttpStatus.CONFLICT, "This account has " + transfers + " transfer" + (transfers > 1 ? "s" : "")
                    + " with other accounts. Archive it instead, or delete those transfers first.");
        }
        db.sql("DELETE FROM accounts WHERE id = ?").param(acc.id()).update();
        return ResponseEntity.noContent().build();
    }
}
