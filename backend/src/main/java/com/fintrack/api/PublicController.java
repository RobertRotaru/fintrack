package com.fintrack.api;

import com.fintrack.money.FxService;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class PublicController {
    private final FxService fx;

    public PublicController(FxService fx) {
        this.fx = fx;
    }

    @GetMapping("/health")
    public Map<String, Boolean> health() {
        return Map.of("ok", true);
    }

    @GetMapping("/fx")
    public Map<String, Object> rates() {
        FxService.Snapshot s = fx.current();
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("base", s.base());
        out.put("rates", s.rates());
        out.put("updatedAt", s.updatedAt());
        out.put("source", s.source());
        out.put("attribution", FxService.ATTRIBUTION);
        return out;
    }
}
