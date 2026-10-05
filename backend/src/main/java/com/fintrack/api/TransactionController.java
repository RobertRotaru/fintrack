package com.fintrack.api;

import static com.fintrack.web.ApiException.bad;
import static com.fintrack.web.ApiException.forbidden;
import static com.fintrack.web.ApiException.notFound;

import com.fintrack.data.Views;
import com.fintrack.data.Visibility;
import com.fintrack.reference.ReferenceData;
import com.fintrack.web.Body;
import com.fintrack.web.Body.NumRule;
import com.fintrack.web.Ids;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
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
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/transactions")
public class TransactionController {
    private final JdbcClient db;
    private final Visibility view;
    private final ReferenceData ref;

    public TransactionController(JdbcClient db, Visibility view, ReferenceData ref) {
        this.db = db;
        this.view = view;
        this.ref = ref;
    }

    @GetMapping
    public List<Views.Transaction> list(@AuthenticationPrincipal UUID me, @RequestParam(required = false) String from,
            @RequestParam(required = false) String to, @RequestParam(required = false) String accountId) {
        LocalDate f = from == null ? null : Body.isoDate(from, "from");
        LocalDate t = to == null ? null : Body.isoDate(to, "to");
        if (accountId != null && Ids.parse(accountId) == null) return List.of();
        return view.visibleTransactions(me, f, t, accountId == null ? null : Ids.parse(accountId));
    }

    /** {@code keepArchived} lets an edit keep its existing (since archived) category. */
    private UUID checkCategory(UUID me, String rawId, String kind, UUID keepArchived) {
        record Cat(String kind, boolean archived) {}
        UUID id = Ids.parse(rawId);
        Cat cat = db.sql("SELECT kind, archived FROM categories WHERE id = ? AND user_id = ?").params(id, me)
                .query((rs, i) -> new Cat(rs.getString("kind"), rs.getBoolean("archived"))).optional()
                .orElseThrow(() -> bad("Unknown category"));
        if (!cat.kind().equals(kind)) throw bad("That category is for " + cat.kind() + "s");
        if (cat.archived() && !id.equals(keepArchived)) throw bad("That category is archived — restore it first");
        return id;
    }

    private BigDecimal amount(Body b, String currency) {
        return b.num("amount", "Amount", NumRule.decimals(ref.decimalsFor(currency)).min(ref.minUnit(currency)));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Views.Transaction create(@AuthenticationPrincipal UUID me, Body b) {
        Views.Account acc = view.visibleAccount(me, Ids.parse(b.str("accountId", "Account", 0))).orElseThrow(() -> bad("Unknown account"));
        String kind = b.oneOf("kind", "Kind", CategoryController.KINDS);
        BigDecimal amount = amount(b, acc.currency());
        UUID category = checkCategory(me, b.str("categoryId", "Category", 0), kind, null);
        LocalDate date = b.truthy("date") ? b.date("date", "Date") : LocalDate.now();
        String note = b.note("note", 200);
        UUID id = UUID.randomUUID();
        db.sql("INSERT INTO transactions (id, account_id, user_id, kind, amount, category_id, date, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
                .params(id, acc.id(), me, kind, amount, category, date, note)
                .update();
        return view.transaction(id).orElseThrow();
    }

    private Views.Transaction editable(UUID me, String rawId) {
        Views.Transaction t = view.transaction(Ids.parse(rawId)).filter(x -> view.visibleAccount(me, x.accountId()).isPresent())
                .orElseThrow(() -> notFound("Transaction not found"));
        if (!t.userId().equals(me)) throw forbidden("Only the person who added this can change it");
        return t;
    }

    @PatchMapping("/{id}")
    public Views.Transaction update(@AuthenticationPrincipal UUID me, @PathVariable String id, Body b) {
        Views.Transaction t = editable(me, id);
        String kind = b.has("kind") ? b.oneOf("kind", "Kind", CategoryController.KINDS) : t.kind();
        UUID accountId = b.has("accountId") ? Ids.parse(b.str("accountId", "Account", 0)) : t.accountId();
        Views.Account acc = view.visibleAccount(me, accountId).orElseThrow(() -> bad("Unknown account"));
        BigDecimal amount = b.has("amount") ? amount(b, acc.currency()) : t.amount();
        UUID category = b.has("categoryId") || b.has("kind")
                ? checkCategory(me, b.nullish("categoryId") ? t.categoryId().toString() : b.str("categoryId", "Category", 0), kind, t.categoryId())
                : t.categoryId();
        LocalDate date = b.has("date") ? b.date("date", "Date") : LocalDate.parse(t.date());
        String note = b.has("note") ? b.note("note", 200) : t.note();
        db.sql("UPDATE transactions SET account_id = ?, kind = ?, amount = ?, category_id = ?, date = ?, note = ? WHERE id = ?")
                .params(acc.id(), kind, amount, category, date, note, t.id())
                .update();
        return view.transaction(t.id()).orElseThrow();
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@AuthenticationPrincipal UUID me, @PathVariable String id) {
        Views.Transaction t = editable(me, id);
        db.sql("DELETE FROM transactions WHERE id = ?").param(t.id()).update();
        return ResponseEntity.noContent().build();
    }
}
