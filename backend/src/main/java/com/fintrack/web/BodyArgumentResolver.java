package com.fintrack.web;

import jakarta.servlet.http.HttpServletRequest;
import java.io.IOException;
import java.io.InputStream;
import org.springframework.core.MethodParameter;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.support.WebDataBinderFactory;
import org.springframework.web.context.request.NativeWebRequest;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.method.support.ModelAndViewContainer;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.DeserializationFeature;
import tools.jackson.databind.ObjectReader;
import tools.jackson.databind.json.JsonMapper;

/**
 * Resolves {@link Body} parameters: reads at most 1 MB, parses JSON bodies
 * (amounts as exact decimals) and treats any other content type as `{}`.
 */
public class BodyArgumentResolver implements HandlerMethodArgumentResolver {
    static final int LIMIT = 1024 * 1024;

    private final ObjectReader reader;

    public BodyArgumentResolver(JsonMapper mapper) {
        this.reader = mapper.reader().with(DeserializationFeature.USE_BIG_DECIMAL_FOR_FLOATS);
    }

    @Override
    public boolean supportsParameter(MethodParameter parameter) {
        return parameter.getParameterType() == Body.class;
    }

    @Override
    public Object resolveArgument(MethodParameter parameter, ModelAndViewContainer mav, NativeWebRequest web, WebDataBinderFactory binders)
            throws IOException {
        HttpServletRequest request = web.getNativeRequest(HttpServletRequest.class);
        if (request == null || !isJson(request.getContentType())) return Body.empty();
        byte[] bytes;
        try (InputStream in = request.getInputStream()) {
            bytes = in.readNBytes(LIMIT + 1);
        }
        if (bytes.length > LIMIT) throw new ApiException(HttpStatus.CONTENT_TOO_LARGE, "Request is too large");
        if (bytes.length == 0) return Body.empty();
        try {
            return Body.of(reader.readTree(bytes));
        } catch (JacksonException e) {
            throw ApiException.bad("Request body is not valid JSON");
        }
    }

    private static boolean isJson(String contentType) {
        if (contentType == null) return false;
        try {
            MediaType type = MediaType.parseMediaType(contentType);
            return type.isCompatibleWith(MediaType.APPLICATION_JSON) || type.getSubtype().endsWith("+json");
        } catch (Exception e) {
            return false;
        }
    }
}
