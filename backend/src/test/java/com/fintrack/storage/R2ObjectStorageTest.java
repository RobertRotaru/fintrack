package com.fintrack.storage;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.fintrack.config.AppProperties;
import java.net.URI;
import java.time.Duration;
import java.util.List;
import org.junit.jupiter.api.Test;

/** The presigned link is the whole security model for uploads, so pin down exactly what it signs. */
class R2ObjectStorageTest {
    static AppProperties props(AppProperties.R2 r2) {
        return new AppProperties("x".repeat(40), Duration.ofDays(1), List.of(), new AppProperties.Fx(false), new AppProperties.Ai("m"),
                new AppProperties.Storage("r2", null, r2));
    }

    static final AppProperties.R2 R2 = new AppProperties.R2("0123456789abcdef", null, "fintrack-photos", "AKIDEXAMPLE", "secret", "https://photos.example.com/");

    @Test
    void presignedUploadPinsKeyTypeLengthAndCache() {
        try (var s = new Closer(new R2ObjectStorage(props(R2)))) {
            ObjectStorage.Upload u = s.storage.presignPut("avatars/u1/abc.webp", "image/webp", 1234, Duration.ofMinutes(5));
            URI url = URI.create(u.url());
            assertThat(url.getHost()).isEqualTo("0123456789abcdef.r2.cloudflarestorage.com");
            assertThat(url.getPath()).isEqualTo("/fintrack-photos/avatars/u1/abc.webp");
            assertThat(u.method()).isEqualTo("PUT");
            assertThat(url.getQuery()).contains("X-Amz-Expires=300").contains("X-Amz-Credential=AKIDEXAMPLE/").contains("/auto/s3/aws4_request");
            // The signature covers the type, the exact length and the cache header: any other body is refused.
            String signed = url.getQuery().replaceAll(".*X-Amz-SignedHeaders=([^&]*).*", "$1");
            assertThat(signed.split(";")).contains("content-type", "content-length", "cache-control", "host");
            // No SDK checksum parameters, which S3-compatible stores don't all accept on presigned PUTs.
            assertThat(url.getQuery().toLowerCase()).doesNotContain("checksum");
            // What the browser must send itself; Host and Content-Length are set by the browser.
            assertThat(u.headers()).containsEntry("content-type", "image/webp").containsEntry("cache-control", R2ObjectStorage.CACHE);
            assertThat(u.headers().keySet()).noneMatch(h -> h.equalsIgnoreCase("host") || h.equalsIgnoreCase("content-length"));
            assertThat(u.size()).isEqualTo(1234);
        }
    }

    @Test
    void publicUrlIsTheBucketsPublicAddress() {
        try (var s = new Closer(new R2ObjectStorage(props(R2)))) {
            assertThat(s.storage.publicUrl("avatars/u1/abc.webp")).isEqualTo("https://photos.example.com/avatars/u1/abc.webp");
        }
    }

    @Test
    void anS3CompatibleEndpointCanBeGivenInstead() {
        var custom = new AppProperties.R2(null, "http://localhost:9000", "b", "k", "s", "http://localhost:9000/b");
        try (var s = new Closer(new R2ObjectStorage(props(custom)))) {
            URI url = URI.create(s.storage.presignPut("avatars/u/x.png", "image/png", 10, Duration.ofMinutes(1)).url());
            assertThat(url.getAuthority()).isEqualTo("localhost:9000");
            assertThat(url.getPath()).isEqualTo("/b/avatars/u/x.png");
        }
    }

    @Test
    void refusesToStartWithMissingSettingsAndSaysWhich() {
        assertThatThrownBy(() -> new R2ObjectStorage(props(new AppProperties.R2(null, null, "b", null, "s", null))))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("R2_ACCESS_KEY_ID")
                .hasMessageContaining("R2_PUBLIC_URL")
                .hasMessageContaining("R2_ACCOUNT_ID")
                .hasMessageNotContaining("R2_BUCKET");
        assertThatThrownBy(() -> new R2ObjectStorage(props(null))).hasMessageContaining("R2_BUCKET");
    }

    @Test
    void sniffsImageTypes() {
        assertThat(ImageSniff.matches("image/webp", new byte[] {'R', 'I', 'F', 'F', 0, 0, 0, 0, 'W', 'E', 'B', 'P'})).isTrue();
        assertThat(ImageSniff.matches("image/png", "<html><body>".getBytes())).isFalse();
        assertThat(ImageSniff.matches("image/jpeg", new byte[] {(byte) 0xff, (byte) 0xd8, (byte) 0xff, 0})).isTrue();
        assertThat(ImageSniff.matches("image/gif", "GIF89a......".getBytes())).isFalse();
    }

    private record Closer(R2ObjectStorage storage) implements AutoCloseable {
        @Override
        public void close() {
            storage.destroy();
        }
    }
}
