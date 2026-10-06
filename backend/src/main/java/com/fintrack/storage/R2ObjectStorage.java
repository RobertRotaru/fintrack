package com.fintrack.storage;

import com.fintrack.config.AppProperties;
import java.net.URI;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.beans.factory.DisposableBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.core.checksums.RequestChecksumCalculation;
import software.amazon.awssdk.core.checksums.ResponseChecksumValidation;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.S3Configuration;
import software.amazon.awssdk.services.s3.model.NoSuchKeyException;
import software.amazon.awssdk.services.s3.model.S3Exception;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.PresignedPutObjectRequest;

/**
 * Cloudflare R2 through its S3 API (any S3-compatible bucket works with {@code R2_ENDPOINT}).
 * Uploads go from the browser straight to the bucket with a presigned PUT that pins the key, content type,
 * exact length and cache header; reads come from the bucket's public URL (r2.dev or a custom domain).
 */
@Component
@ConditionalOnProperty(name = "fintrack.storage.driver", havingValue = "r2")
public class R2ObjectStorage implements ObjectStorage, DisposableBean {
    /** Keys change on every upload, so an object never changes: browsers and the CDN may cache it for a year. */
    static final String CACHE = "public, max-age=31536000, immutable";
    /** Sent by the browser on its own (and not allowed to be set by scripts). */
    private static final Set<String> BROWSER_HEADERS = Set.of("host", "content-length");

    private final S3Client s3;
    private final S3Presigner presigner;
    private final String bucket;
    private final String publicBase;

    public R2ObjectStorage(AppProperties props) {
        AppProperties.R2 r2 = props.storage() == null ? null : props.storage().r2();
        List<String> missing = new ArrayList<>();
        if (r2 == null || blank(r2.bucket())) missing.add("R2_BUCKET");
        if (r2 == null || blank(r2.accessKeyId())) missing.add("R2_ACCESS_KEY_ID");
        if (r2 == null || blank(r2.secretAccessKey())) missing.add("R2_SECRET_ACCESS_KEY");
        if (r2 == null || blank(r2.publicUrl())) missing.add("R2_PUBLIC_URL");
        if (r2 == null || (blank(r2.endpoint()) && blank(r2.accountId()))) missing.add("R2_ACCOUNT_ID (or R2_ENDPOINT)");
        if (!missing.isEmpty()) throw new IllegalStateException("STORAGE_DRIVER=r2 needs " + String.join(", ", missing));

        URI endpoint = URI.create(blank(r2.endpoint()) ? "https://" + r2.accountId().strip() + ".r2.cloudflarestorage.com" : r2.endpoint().strip());
        var credentials = StaticCredentialsProvider.create(AwsBasicCredentials.create(r2.accessKeyId().strip(), r2.secretAccessKey().strip()));
        var config = S3Configuration.builder().pathStyleAccessEnabled(true).build();
        // R2's region is always "auto". Checksums only when an operation requires one: the SDK's newer
        // defaults add checksum headers that S3-compatible stores don't all accept.
        this.s3 = S3Client.builder()
                .endpointOverride(endpoint)
                .region(Region.of("auto"))
                .credentialsProvider(credentials)
                .serviceConfiguration(config)
                .requestChecksumCalculation(RequestChecksumCalculation.WHEN_REQUIRED)
                .responseChecksumValidation(ResponseChecksumValidation.WHEN_REQUIRED)
                .build();
        this.presigner = S3Presigner.builder()
                .endpointOverride(endpoint)
                .region(Region.of("auto"))
                .credentialsProvider(credentials)
                .serviceConfiguration(config)
                .build();
        this.bucket = r2.bucket().strip();
        this.publicBase = r2.publicUrl().strip().replaceAll("/+$", "");
    }

    private static boolean blank(String s) {
        return s == null || s.isBlank();
    }

    @Override
    public Upload presignPut(String key, String contentType, long size, Duration ttl) {
        PresignedPutObjectRequest p = presigner.presignPutObject(r -> r
                .signatureDuration(ttl)
                .putObjectRequest(put -> put.bucket(bucket).key(key).contentType(contentType).contentLength(size).cacheControl(CACHE)));
        Map<String, String> headers = new LinkedHashMap<>();
        p.signedHeaders().forEach((name, values) -> {
            if (!BROWSER_HEADERS.contains(name.toLowerCase())) headers.put(name, String.join(",", values));
        });
        return new Upload("PUT", p.url().toString(), headers, size, Instant.now().plus(ttl));
    }

    @Override
    public String publicUrl(String key) {
        return publicBase + "/" + key;
    }

    @Override
    public byte[] head(String key, int n) {
        try {
            return s3.getObjectAsBytes(r -> r.bucket(bucket).key(key).range("bytes=0-" + (n - 1))).asByteArray();
        } catch (NoSuchKeyException e) {
            return null;
        } catch (S3Exception e) {
            if (e.statusCode() == 404) return null;
            throw e;
        }
    }

    @Override
    public void delete(String key) {
        s3.deleteObject(r -> r.bucket(bucket).key(key));
    }

    @Override
    public void destroy() {
        presigner.close();
        s3.close();
    }
}
