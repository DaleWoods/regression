package regression.analytics.util;

import static org.junit.jupiter.api.Assertions.fail;

public final class AssertLog {

    private AssertLog() {}

    public static void check(String passMsg,
                             boolean condition,
                             String failMsg) {
        if (condition) {
            System.out.println("[PASS] " + passMsg);
        } else {
            System.out.println("[FAIL] " + failMsg);
            fail(failMsg);
        }
    }

    public static void info(String msg) {
        System.out.println("[INFO] " + msg);
    }
}