package com.fintrack.api;

import static com.fintrack.web.ApiException.bad;
import static com.fintrack.web.ApiException.conflict;
import static com.fintrack.web.ApiException.forbidden;
import static com.fintrack.web.ApiException.notFound;

import com.fintrack.data.Views;
import com.fintrack.data.Visibility;
import com.fintrack.web.Body;
import com.fintrack.web.Ids;
import java.security.SecureRandom;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** A family: members share the accounts and goals they choose. "No family" is JSON null. */
@RestController
@RequestMapping("/api/household")
public class HouseholdController {
    // Unambiguous characters only — codes get read aloud and typed on phones.
    private static final String ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private static final SecureRandom RANDOM = new SecureRandom();

    private final JdbcClient db;
    private final Visibility view;

    public HouseholdController(JdbcClient db, Visibility view) {
        this.db = db;
        this.view = view;
    }

    static String inviteCode() {
        byte[] bytes = new byte[8];
        RANDOM.nextBytes(bytes);
        StringBuilder code = new StringBuilder();
        for (byte b : bytes) code.append(ALPHABET.charAt((b & 0xff) % ALPHABET.length()));
        return code.substring(0, 4) + "-" + code.substring(4);
    }

    private ResponseEntity<Object> householdOf(UUID me) {
        return view.household(me).<ResponseEntity<Object>>map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.ok().contentType(MediaType.APPLICATION_JSON).body("null"));
    }

    private Views.Household required(UUID me) {
        return view.household(me).orElseThrow(() -> notFound("You are not in a family"));
    }

    private static boolean isOwner(Views.Household h, UUID me) {
        return h.members().stream().anyMatch(m -> m.userId().equals(me) && "owner".equals(m.role()));
    }

    @GetMapping
    public ResponseEntity<Object> get(@AuthenticationPrincipal UUID me) {
        return householdOf(me);
    }

    @PostMapping
    @Transactional
    public ResponseEntity<Object> create(@AuthenticationPrincipal UUID me, Body b) {
        if (view.householdIdOf(me) != null) throw conflict("You are already in a family");
        String name = b.str("name", "Name", 60);
        UUID id = UUID.randomUUID();
        db.sql("INSERT INTO households (id, name, invite_code, created_by) VALUES (?, ?, ?, ?)").params(id, name, inviteCode(), me).update();
        db.sql("INSERT INTO household_members (household_id, user_id, role) VALUES (?, ?, 'owner')").params(id, me).update();
        return ResponseEntity.status(HttpStatus.CREATED).body(view.household(me).orElseThrow());
    }

    @PatchMapping
    public ResponseEntity<Object> rename(@AuthenticationPrincipal UUID me, Body b) {
        Views.Household h = required(me);
        db.sql("UPDATE households SET name = ? WHERE id = ?").params(b.str("name", "Name", 60), h.id()).update();
        return householdOf(me);
    }

    @PostMapping("/join")
    public ResponseEntity<Object> join(@AuthenticationPrincipal UUID me, Body b) {
        if (view.householdIdOf(me) != null) throw conflict("Leave your current family before joining another");
        String code = b.str("code", "Invite code", 0).toUpperCase().replaceAll("[^A-Z0-9]", "");
        String formatted = code.substring(0, Math.min(4, code.length())) + "-" + (code.length() > 4 ? code.substring(4, Math.min(8, code.length())) : "");
        UUID household = db.sql("SELECT id FROM households WHERE invite_code = ?").param(formatted).query(UUID.class).optional()
                .orElseThrow(() -> bad("That invite code is not valid"));
        db.sql("INSERT INTO household_members (household_id, user_id, role) VALUES (?, ?, 'member')").params(household, me).update();
        return householdOf(me);
    }

    @PostMapping("/invite-code")
    public ResponseEntity<Object> newCode(@AuthenticationPrincipal UUID me) {
        Views.Household h = required(me);
        if (!isOwner(h, me)) throw forbidden("Only the family owner can reset the code");
        db.sql("UPDATE households SET invite_code = ? WHERE id = ?").params(inviteCode(), h.id()).update();
        return householdOf(me);
    }

    private void unshare(UUID userId, UUID household) {
        db.sql("UPDATE accounts SET household_id = NULL WHERE owner_id = ? AND household_id = ?").params(userId, household).update();
        db.sql("UPDATE goals SET household_id = NULL WHERE user_id = ? AND household_id = ?").params(userId, household).update();
        db.sql("DELETE FROM household_members WHERE user_id = ?").param(userId).update();
    }

    /** Leaving un-shares your accounts and goals; the last member out deletes the family. */
    @PostMapping("/leave")
    @Transactional
    public ResponseEntity<Object> leave(@AuthenticationPrincipal UUID me) {
        Views.Household h = required(me);
        unshare(me, h.id());
        List<Views.Member> rest = h.members().stream().filter(m -> !m.userId().equals(me)).toList();
        if (rest.isEmpty()) db.sql("DELETE FROM households WHERE id = ?").param(h.id()).update();
        else if (isOwner(h, me)) db.sql("UPDATE household_members SET role = 'owner' WHERE user_id = ?").param(rest.getFirst().userId()).update();
        return householdOf(me);
    }

    @DeleteMapping("/members/{userId}")
    @Transactional
    public ResponseEntity<Object> remove(@AuthenticationPrincipal UUID me, @PathVariable String userId) {
        Views.Household h = required(me);
        if (!isOwner(h, me)) throw forbidden("Only the family owner can remove members");
        UUID target = Ids.parse(userId);
        if (me.equals(target)) throw bad("Use \"leave\" to remove yourself");
        if (h.members().stream().noneMatch(m -> m.userId().equals(target))) throw notFound("Member not found");
        unshare(target, h.id());
        return householdOf(me);
    }
}
