package com.fintrack.importer;

import java.nio.file.Path;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.stereotype.Component;

/**
 * One-off migration from the old backend:
 * {@code java -jar fintrack.jar --import-sqlite=path/to/finance.db}
 * imports, prints a summary and exits (status 1 on failure).
 */
@Component
@ConditionalOnProperty("import-sqlite")
public class ImportCommand implements ApplicationRunner {
    private final SqliteImporter importer;
    private final ConfigurableApplicationContext context;

    public ImportCommand(SqliteImporter importer, ConfigurableApplicationContext context) {
        this.importer = importer;
        this.context = context;
    }

    @Override
    public void run(ApplicationArguments args) {
        String file = context.getEnvironment().getProperty("import-sqlite");
        int status = 0;
        try {
            System.out.println("Imported from " + file + ": " + importer.importFrom(Path.of(file)));
        } catch (Exception e) {
            System.err.println("Import failed, nothing was changed: " + e.getMessage());
            status = 1;
        }
        int exit = status;
        System.exit(SpringApplication.exit(context, () -> exit));
    }
}
