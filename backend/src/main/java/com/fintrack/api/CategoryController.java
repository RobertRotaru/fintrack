package com.fintrack.api;

import static com.fintrack.web.ApiException.bad;
import static com.fintrack.web.ApiException.notFound;

import com.fintrack.data.Views;
import com.fintrack.data.Visibility;
import com.fintrack.web.Body;
import com.fintrack.web.Ids;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
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
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/categories")
public class CategoryController {
    static final List<String> KINDS = List.of("expense", "income");

    private final JdbcClient db;

    public CategoryController(JdbcClient db) {
        this.db = db;
    }

    /** Names are unique per kind among active categories, ignoring case. */
    private void assertUniqueName(UUID me, String kind, String name, UUID exceptId) {
        boolean clash = db.sql("""
                SELECT 1 FROM categories WHERE user_id = ? AND kind = ? AND lower(name) = lower(?) AND NOT archived AND id IS DISTINCT FROM ?""")
                .params(me, kind, name, exceptId).query().optionalValue().isPresent();
        if (clash) throw bad("You already have a \"" + name + "\" category");
    }

    private Views.Category get(UUID id) {
        return db.sql("SELECT * FROM categories WHERE id = ?").param(id).query((rs, i) -> Visibility.category(rs)).single();
    }

    private Views.Category owned(UUID me, String rawId) {
        UUID id = Ids.parse(rawId);
        return db.sql("SELECT * FROM categories WHERE id = ? AND user_id = ?").params(id, me).query((rs, i) -> Visibility.category(rs))
                .optional().orElseThrow(() -> notFound("Category not found"));
    }

    @GetMapping
    public List<Views.Category> list(@AuthenticationPrincipal UUID me) {
        return db.sql("SELECT * FROM categories WHERE user_id = ? ORDER BY kind, archived, is_default DESC, name COLLATE \"C\"")
                .param(me).query((rs, i) -> Visibility.category(rs)).list();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Views.Category create(@AuthenticationPrincipal UUID me, Body b) {
        String kind = b.oneOf("kind", "Kind", KINDS);
        String name = b.str("name", "Name", 40);
        assertUniqueName(me, kind, name, null);
        String icon = b.nullish("icon") ? Body.iconNameValue("tag") : b.iconName("icon");
        String color = b.nullish("color") ? Body.hexColorValue("#64748b") : b.hexColor("color");
        UUID id = UUID.randomUUID();
        db.sql("INSERT INTO categories (id, user_id, kind, name, icon, color) VALUES (?, ?, ?, ?, ?, ?)").params(id, me, kind, name, icon, color).update();
        return get(id);
    }

    @PatchMapping("/{id}")
    @Transactional
    public Views.Category update(@AuthenticationPrincipal UUID me, @PathVariable String id, Body b) {
        Views.Category c = owned(me, id);
        // All-or-nothing: an invalid field rolls back the ones before it.
        if (b.has("name")) {
            String name = b.str("name", "Name", 40);
            assertUniqueName(me, c.kind(), name, c.id());
            db.sql("UPDATE categories SET name = ? WHERE id = ?").params(name, c.id()).update();
        }
        if (b.has("icon")) db.sql("UPDATE categories SET icon = ? WHERE id = ?").params(b.iconName("icon"), c.id()).update();
        if (b.has("color")) db.sql("UPDATE categories SET color = ? WHERE id = ?").params(b.hexColor("color"), c.id()).update();
        if (b.has("archived")) {
            boolean archived = b.truthy("archived");
            // Restoring must not create a duplicate of an active category.
            if (!archived) assertUniqueName(me, c.kind(), c.name(), c.id());
            db.sql("UPDATE categories SET archived = ? WHERE id = ?").params(archived, c.id()).update();
        }
        return get(c.id());
    }

    /** Categories in use are archived rather than deleted so history keeps its labels. */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@AuthenticationPrincipal UUID me, @PathVariable String id) {
        Views.Category c = owned(me, id);
        boolean used = db.sql("SELECT 1 FROM transactions WHERE category_id = ? LIMIT 1").param(c.id()).query().optionalValue().isPresent();
        if (used) db.sql("UPDATE categories SET archived = TRUE WHERE id = ?").param(c.id()).update();
        else db.sql("DELETE FROM categories WHERE id = ?").param(c.id()).update();
        return ResponseEntity.noContent().build();
    }
}
