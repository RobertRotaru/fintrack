package com.fintrack.api;

import static com.fintrack.web.ApiException.bad;
import static com.fintrack.web.ApiException.forbidden;
import static com.fintrack.web.ApiException.notFound;

import com.fintrack.data.Views;
import com.fintrack.data.Visibility;
import com.fintrack.money.FxService;
import com.fintrack.money.Money;
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
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** Money moved between two accounts the user can see — not income or spending. */
@RestController
@RequestMapping("/api/transfers")
public class TransferController {
    private final JdbcClient db;
    private final Visibility view;
    private final ReferenceData ref;
    private final FxService fx;

    public TransferController(JdbcClient db, Visibility view, ReferenceData ref, FxService fx) {
        this.db = db;
        this.view = view;
        this.ref = ref;
        this.fx = fx;
    }

    @GetMapping
    public List<Views.Transfer> list(@AuthenticationPrincipal UUID me) {
        return view.visibleTransfers(me);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Views.Transfer create(@AuthenticationPrincipal UUID me, Body b) {
        var from = view.visibleAccount(me, Ids.parse(b.str("fromAccountId", "From account", 0)));
        var to = view.visibleAccount(me, Ids.parse(b.str("toAccountId", "To account", 0)));
        if (from.isEmpty() || to.isEmpty()) throw bad("Unknown account");
        Views.Account src = from.get();
        Views.Account dst = to.get();
        if (src.id().equals(dst.id())) throw bad("Pick two different accounts");
        BigDecimal amount = b.num("amount", "Amount", NumRule.decimals(ref.decimalsFor(src.currency())).min(ref.minUnit(src.currency())));
        boolean given = b.has("toAmount") && !b.nullish("toAmount") && !(b.get("toAmount").isString() && b.get("toAmount").stringValue().isEmpty());
        BigDecimal toAmount = given
                ? b.num("toAmount", "Received amount", NumRule.decimals(ref.decimalsFor(dst.currency())).min(ref.minUnit(dst.currency())))
                : Money.round(fx.convert(amount.doubleValue(), src.currency(), dst.currency()), ref.decimalsFor(dst.currency()));
        if (toAmount.signum() <= 0) throw bad("That amount is too small to arrive in " + dst.currency());
        LocalDate date = b.truthy("date") ? b.date("date", "Date") : LocalDate.now();
        String note = b.note("note", 200);
        UUID id = UUID.randomUUID();
        db.sql("INSERT INTO transfers (id, user_id, from_account_id, to_account_id, amount, to_amount, date, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
                .params(id, me, src.id(), dst.id(), amount, toAmount, date, note)
                .update();
        return view.visibleTransfers(me).stream().filter(x -> x.id().equals(id)).findFirst().orElseThrow();
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@AuthenticationPrincipal UUID me, @PathVariable String id) {
        UUID tid = Ids.parse(id);
        Views.Transfer x = view.visibleTransfers(me).stream().filter(t -> t.id().equals(tid)).findFirst().orElseThrow(() -> notFound("Transfer not found"));
        if (!x.userId().equals(me)) throw forbidden("Only the person who added this can remove it");
        db.sql("DELETE FROM transfers WHERE id = ?").param(x.id()).update();
        return ResponseEntity.noContent().build();
    }
}
