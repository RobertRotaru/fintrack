# syntax=docker/dockerfile:1
FROM eclipse-temurin:21-jdk AS build
WORKDIR /src
COPY gradlew settings.gradle.kts build.gradle.kts ./
COPY gradle gradle
RUN ./gradlew dependencies -q > /dev/null
COPY src src
RUN ./gradlew bootJar -x test -q

FROM eclipse-temurin:21-jre
RUN useradd --system --uid 10001 fintrack
WORKDIR /app
COPY --from=build /src/build/libs/fintrack-backend-*.jar app.jar
USER fintrack
ENV SPRING_PROFILES_ACTIVE=prod
EXPOSE 4000
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75", "-jar", "/app/app.jar"]
