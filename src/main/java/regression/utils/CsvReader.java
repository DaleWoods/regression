package regression.utils;

import java.io.*;
import java.util.*;

public class CsvReader {

    /**
     * Minimal CSV reader with a couple of safety tweaks:
     * - Skips blank lines
     * - Supports comma OR semicolon as delimiter (picks whichever is present)
     * - Trims each field
     */
    public static List<String[]> readCsv(String filePath) throws IOException {
        List<String[]> data = new ArrayList<>();
        try (BufferedReader br = new BufferedReader(new FileReader(filePath))) {
            String line;
            while ((line = br.readLine()) != null) {
                if (line.trim().isEmpty()) continue; // skip blank lines

                // Pick delimiter for this line (comma default; fall back to semicolon)
                String delimiter = line.contains(",") ? "," : ";";
                String[] cols = line.split(delimiter, -1); // keep empty trailing fields

                // Trim each field
                for (int i = 0; i < cols.length; i++) {
                    cols[i] = cols[i] == null ? "" : cols[i].trim();
                }

                data.add(cols);
            }
        }
        return data;
    }
}