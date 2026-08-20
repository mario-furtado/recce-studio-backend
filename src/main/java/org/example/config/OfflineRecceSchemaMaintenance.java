package org.example.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

@Component
public class OfflineRecceSchemaMaintenance implements CommandLineRunner {
    private static final Logger log = LoggerFactory.getLogger(OfflineRecceSchemaMaintenance.class);

    private final JdbcTemplate jdbcTemplate;
    private final String datasourceUrl;

    public OfflineRecceSchemaMaintenance(
            JdbcTemplate jdbcTemplate,
            @Value("${spring.datasource.url:}") String datasourceUrl) {
        this.jdbcTemplate = jdbcTemplate;
        this.datasourceUrl = datasourceUrl;
    }

    @Override
    public void run(String... args) {
        if (!StringUtils.hasText(datasourceUrl) || !datasourceUrl.toLowerCase().contains("postgresql")) {
            return;
        }

        migrateLargeObjectColumnToText("markers_json");
        migrateLargeObjectColumnToText("gps_track_json");
    }

    private void migrateLargeObjectColumnToText(String columnName) {
        String columnType = columnType(columnName);
        if (!"oid".equalsIgnoreCase(columnType)) {
            return;
        }

        try {
            jdbcTemplate.execute(
                    "ALTER TABLE offline_recce_syncs "
                            + "ALTER COLUMN " + columnName + " TYPE text "
                            + "USING CASE "
                            + "WHEN " + columnName + " IS NULL THEN NULL "
                            + "ELSE convert_from(lo_get(" + columnName + "), 'UTF8') "
                            + "END"
            );
            log.info("Converted offline_recce_syncs.{} from oid to text", columnName);
        } catch (Exception error) {
            log.warn("Could not convert offline_recce_syncs.{} from oid to text: {}", columnName, error.getMessage());
        }
    }

    private String columnType(String columnName) {
        try {
            return jdbcTemplate.queryForObject(
                    "SELECT udt_name "
                            + "FROM information_schema.columns "
                            + "WHERE table_name = 'offline_recce_syncs' "
                            + "AND column_name = ? "
                            + "ORDER BY CASE WHEN table_schema = current_schema() THEN 0 ELSE 1 END "
                            + "LIMIT 1",
                    new Object[]{columnName},
                    String.class
            );
        } catch (EmptyResultDataAccessException ignored) {
            return "";
        } catch (Exception error) {
            log.warn("Could not inspect offline_recce_syncs.{} type: {}", columnName, error.getMessage());
            return "";
        }
    }
}
