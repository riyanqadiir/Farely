const fs = require("fs/promises");
const path = require("path");
const {
  withAndroidManifest,
  withDangerousMod,
  createRunOncePlugin,
} = require("expo/config-plugins");

const SERVICE_NAME = ".MyAccessibilityService";
const XML_FILE_NAME = "accessibility_service_config.xml";

function ensureServiceInManifest(androidManifest) {
  const app = androidManifest?.manifest?.application?.[0];
  if (!app) return androidManifest;

  app.service = app.service || [];
  const alreadyExists = app.service.some(
    (entry) => entry?.$?.["android:name"] === SERVICE_NAME
  );

  if (!alreadyExists) {
    app.service.push({
      $: {
        "android:name": SERVICE_NAME,
        "android:permission": "android.permission.BIND_ACCESSIBILITY_SERVICE",
        "android:exported": "true",
      },
      "intent-filter": [
        {
          action: [
            {
              $: {
                "android:name":
                  "android.accessibilityservice.AccessibilityService",
              },
            },
          ],
        },
      ],
      "meta-data": [
        {
          $: {
            "android:name": "android.accessibilityservice",
            "android:resource": "@xml/accessibility_service_config",
          },
        },
      ],
    });
  }

  return androidManifest;
}

function getMainApplicationPath(javaRoot, packagePath) {
  return {
    java: path.join(javaRoot, packagePath, "MainApplication.java"),
    kotlin: path.join(javaRoot, packagePath, "MainApplication.kt"),
  };
}

async function patchMainApplication(javaRoot, packagePath) {
  const mainPaths = getMainApplicationPath(javaRoot, packagePath);
  const packageClass = "FareAccessibilityPackage";

  try {
    const javaContent = await fs.readFile(mainPaths.java, "utf8");
    if (!javaContent.includes(packageClass)) {
      const withImport = javaContent.replace(
        `import com.facebook.react.ReactPackage;`,
        `import com.facebook.react.ReactPackage;\nimport ${packagePath.replaceAll("/", ".")}.${packageClass};`
      );
      const withPackage = withImport.replace(
        `packages.add(new MainReactPackage());`,
        `packages.add(new MainReactPackage());\n      packages.add(new ${packageClass}());`
      );
      await fs.writeFile(mainPaths.java, withPackage);
    }
    return;
  } catch {}

  try {
    const ktContent = await fs.readFile(mainPaths.kotlin, "utf8");
    if (!ktContent.includes(packageClass)) {
      const withImport = ktContent.replace(
        `import com.facebook.react.ReactPackage`,
        `import com.facebook.react.ReactPackage\nimport ${packagePath.replaceAll("/", ".")}.${packageClass}`
      );
      let withPackage = withImport;
      if (withPackage.includes(`packages.add(MainReactPackage())`)) {
        withPackage = withPackage.replace(
          `packages.add(MainReactPackage())`,
          `packages.add(MainReactPackage())\n      packages.add(${packageClass}())`
        );
      } else if (withPackage.includes(`PackageList(this).packages.apply {`)) {
        withPackage = withPackage.replace(
          `PackageList(this).packages.apply {`,
          `PackageList(this).packages.apply {\n              add(${packageClass}())`
        );
      }
      await fs.writeFile(mainPaths.kotlin, withPackage);
    } else if (
      ktContent.includes(`PackageList(this).packages.apply {`) &&
      !ktContent.includes(`add(${packageClass}())`)
    ) {
      const withPackage = ktContent.replace(
        `PackageList(this).packages.apply {`,
        `PackageList(this).packages.apply {\n              add(${packageClass}())`
      );
      await fs.writeFile(mainPaths.kotlin, withPackage);
    }
  } catch {}
}

async function createNativeFiles(javaRoot, packagePath, packageName) {
  const packageDir = path.join(javaRoot, packagePath);
  const xmlDir = path.join(
    javaRoot,
    "..",
    "res",
    "xml"
  );

  await fs.mkdir(packageDir, { recursive: true });
  await fs.mkdir(xmlDir, { recursive: true });

  const serviceFile = path.join(packageDir, "MyAccessibilityService.java");
  const moduleFile = path.join(packageDir, "FareAccessibilityModule.java");
  const packageFile = path.join(packageDir, "FareAccessibilityPackage.java");
  const xmlFile = path.join(xmlDir, XML_FILE_NAME);

  const serviceSource = `package ${packageName};

import android.accessibilityservice.AccessibilityService;
import android.util.Log;
import android.view.accessibility.AccessibilityEvent;
import android.view.accessibility.AccessibilityNodeInfo;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.ArrayList;
import android.content.Context;
import android.content.SharedPreferences;

public class MyAccessibilityService extends AccessibilityService {
    /** After PKR/Rs: comma as thousands (1,157) OR plain 2+ digits; optional .paisa */
    private static final Pattern FARE_PATTERN = Pattern.compile(
            "(?i)(?:PKR|Rs\\\\.?|R\\\\.s\\\\.?|₨|rupees?)[\\\\s:]*((?:[0-9]{1,3}(?:,[0-9]{3})+|[0-9]{2,})(?:\\\\.[0-9]{1,2})?)"
    );
    /** Yango often prints \\\"1,157 Rs.\\\" (amount before currency). */
    private static final Pattern FARE_PATTERN_AMOUNT_FIRST = Pattern.compile(
            "(?i)((?:[0-9]{1,3}(?:,[0-9]{3})+|[0-9]{2,})(?:\\\\.[0-9]{1,2})?)\\\\s*(?:PKR|Rs\\\\.?|R\\\\.s\\\\.?|₨|rupees?)\\\\b"
    );
    /** Same numeric shapes anywhere in a fare-like string (avoids \\\"1,157\\\" → 157 bug). */
    private static final Pattern FALLBACK_NUMBER_PATTERN = Pattern.compile(
            "((?:[0-9]{1,3}(?:,[0-9]{3})+|[0-9]{2,})(?:\\\\.[0-9]{1,2})?)"
    );
    /** Bykea: amounts sometimes appear without currency in the same node — pick 3–6 digit PK-style totals. */
    private static final Pattern BYKEA_STANDALONE_MONEY = Pattern.compile(
            "(?:^|[^0-9,.])((?:[0-9]{1,3}(?:,[0-9]{3})+|[0-9]{3,6})(?:\\\\.[0-9]{1,2})?)(?:[^0-9,.]|$)"
    );

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
        if (event == null) return;

        String packageName = event.getPackageName() != null ? event.getPackageName().toString() : "";
        String provider = detectProvider(packageName);
        if (provider == null) {
            if (packageName.contains("yango") || packageName.contains("bykea") || packageName.contains("indrive")) {
                FareAccessibilityEmitter.emitDebug(this, "Unknown provider package: " + packageName);
            }
            return;
        }

        AccessibilityNodeInfo rootNode = getRootInActiveWindow();
        if (rootNode == null) {
            FareAccessibilityEmitter.emitDebug(this, provider + ": root node unavailable");
            return;
        }

        FareAccessibilityEmitter.emitDebug(this, provider + ": event type " + event.getEventType());

        SharedPreferences spHand = getSharedPreferences("farely_accessibility", Context.MODE_PRIVATE);
        final String rideTypeHandoff = spHand.getString("ride_type", "car");
        final boolean carAcHandoff = spHand.getBoolean("car_ac", false);

        if ("Bykea".equals(provider)) {
            ArrayList<Double> bykeaFares = new ArrayList<>();
            ArrayList<String> bykeaRaws = new ArrayList<>();
            harvestBykeaFares(rootNode, bykeaFares, bykeaRaws);
            Log.d("BykeaFare", "handoff rt=" + rideTypeHandoff + " ac=" + carAcHandoff + " candidates=" + bykeaFares.size());
            FareAccessibilityEmitter.emitDebug(this, "BykeaFare: handoff rt=" + rideTypeHandoff + " ac=" + carAcHandoff + " candidates=" + bykeaFares.size());
            if (bykeaFares.isEmpty()) {
                FareAccessibilityEmitter.emitDebug(this, "BykeaFare: no numeric candidates in tree");
                return;
            }
            ArrayList<Integer> idx = new ArrayList<>();
            for (int i = 0; i < bykeaFares.size(); i++) {
                if (matchesBykeaRideHint(bykeaRaws.get(i), rideTypeHandoff, carAcHandoff)) {
                    idx.add(i);
                }
            }
            if (idx.isEmpty()) {
                for (int i = 0; i < bykeaFares.size(); i++) {
                    idx.add(i);
                }
                FareAccessibilityEmitter.emitDebug(this, "BykeaFare: ride-hint matched none, using all rows");
            } else {
                FareAccessibilityEmitter.emitDebug(this, "BykeaFare: ride-hint kept " + idx.size() + " rows");
            }
            BykeaPick bp = computeBykeaPick(bykeaFares, bykeaRaws, idx, rideTypeHandoff, carAcHandoff);
            double pick = bp.fare;
            String pickRaw = bp.raw;
            if (pick > 0 && bykeaFareRowIsAddressOrPostcodeNoise(pickRaw.toLowerCase(), pick)) {
                FareAccessibilityEmitter.emitDebug(this, "BykeaFare: rejected pick as address/postcode noise");
                pick = 0;
            }
            if (pick >= 50 && pick <= 100000) {
                Log.d("BykeaFare", "pick=" + Math.round(pick) + " raw=" + (pickRaw.length() > 120 ? pickRaw.substring(0, 120) + "…" : pickRaw));
                Log.d("UI_DATA", provider + " fare (bykea): " + pick);
                FareAccessibilityEmitter.emit(this, provider, pick, pickRaw);
                FareAccessibilityEmitter.emitDebug(this, "BykeaFare: picked PKR " + Math.round(pick));
            } else {
                FareAccessibilityEmitter.emitDebug(this, "BykeaFare: pick out of range (" + pick + ")");
            }
        } else {
            traverseNode(rootNode, provider, rideTypeHandoff, carAcHandoff);
        }
    }

    private static final class BykeaPick {
        final double fare;
        final String raw;
        BykeaPick(double f, String r) {
            this.fare = f;
            this.raw = r != null ? r : "";
        }
    }

    private boolean bykeaSchemeLeadingNumberNoise(String lower, double fare) {
        if (lower == null) return false;
        if (fare > 199 || fare < 50) return false;
        String t = lower.trim();
        if (!t.matches("^[0-9]{1,3}\\\\s+.+")) return false;
        if (!(lower.contains("scheme") || lower.contains("plot ") || lower.contains(" plot"))) return false;
        if (moneyCueLine(lower)) return false;
        try {
            String head = t.replaceFirst("^([0-9]{1,3})\\\\s.*", "$1");
            double lead = Double.parseDouble(head);
            return Math.abs(lead - fare) < 0.5;
        } catch (Exception e) {
            return false;
        }
    }

    private double bykeaMinInBand(ArrayList<Double> pf, double lo, double hi) {
        double best = -1;
        for (int i = 0; i < pf.size(); i++) {
            double f = pf.get(i);
            if (f < lo || f > hi) continue;
            if (best < 0 || f < best) best = f;
        }
        return best;
    }

    private double bykeaMaxAtMost(ArrayList<Double> pf, double cap) {
        double best = -1;
        for (int i = 0; i < pf.size(); i++) {
            double f = pf.get(i);
            if (f > cap) continue;
            if (best < 0 || f > best) best = f;
        }
        return best;
    }

    /** Largest fare in [lo, hi] (inclusive); -1 if none. */
    private double bykeaMaxInClosedBand(ArrayList<Double> wf, double lo, double hi) {
        double best = -1;
        for (int i = 0; i < wf.size(); i++) {
            double f = wf.get(i);
            if (f < lo || f > hi) continue;
            if (best < 0 || f > best) best = f;
        }
        return best;
    }

    /**
     * Removes bare Car PLUS style outliers (e.g. 1350 next to 620) where the top value is far above the rest.
     * Mutates wf/wr in place.
     */
    private void bykeaStripLargestOutlierIfPlusGap(ArrayList<Double> wf, ArrayList<String> wr) {
        while (wf.size() >= 2) {
            double m1 = -1;
            double m2 = -1;
            for (int i = 0; i < wf.size(); i++) {
                double f = wf.get(i);
                if (f > m1) {
                    m2 = m1;
                    m1 = f;
                } else if (f > m2) {
                    m2 = f;
                }
            }
            if (m1 < 820) return;
            if (m2 < 220) return;
            if (m1 <= m2 * 1.38) return;
            int rm = -1;
            for (int i = 0; i < wf.size(); i++) {
                if (Math.abs(wf.get(i) - m1) < 0.5) {
                    rm = i;
                    break;
                }
            }
            if (rm < 0) return;
            wf.remove(rm);
            wr.remove(rm);
        }
    }

    private String bykeaFirstRawForFare(ArrayList<Double> pf, ArrayList<String> pr, double fare) {
        for (int i = 0; i < pf.size(); i++) {
            if (Math.abs(pf.get(i) - fare) < 0.5) return pr.get(i);
        }
        return "";
    }

    private BykeaPick computeBykeaPick(ArrayList<Double> bykeaFares, ArrayList<String> bykeaRaws,
            ArrayList<Integer> idx, String rideTypeHandoff, boolean carAcHandoff) {
        ArrayList<Double> pf = new ArrayList<>();
        ArrayList<String> pr = new ArrayList<>();
        for (int j = 0; j < idx.size(); j++) {
            int i = idx.get(j);
            double f = bykeaFares.get(i);
            String raw = bykeaRaws.get(i);
            String s = raw.toLowerCase();
            if (bykeaFareRowIsAddressOrPostcodeNoise(s, f)) continue;
            if (bykeaSchemeLeadingNumberNoise(s, f)) continue;
            pf.add(f);
            pr.add(raw);
        }
        if (pf.isEmpty()) {
            return new BykeaPick(0, "");
        }
        if (pf.size() > 1) {
            StringBuilder sb = new StringBuilder();
            for (int k = 0; k < pf.size(); k++) {
                if (k > 0) sb.append("; ");
                String r = pr.get(k);
                sb.append(Math.round(pf.get(k))).append("=");
                sb.append(r.length() > 48 ? r.substring(0, 48) + "…" : r);
            }
            Log.d("BykeaFare", "filtered=" + sb);
        }
        String rt = rideTypeHandoff == null ? "car" : rideTypeHandoff.trim().toLowerCase();

        if ("car".equals(rt) && !carAcHandoff) {
            ArrayList<Double> wf = new ArrayList<>();
            ArrayList<String> wr = new ArrayList<>();
            for (int i = 0; i < pf.size(); i++) {
                wf.add(pf.get(i));
                wr.add(pr.get(i));
            }
            bykeaStripLargestOutlierIfPlusGap(wf, wr);
            if (wf.size() != pf.size()) {
                Log.d("BykeaFare", "stripPlusGap removed " + (pf.size() - wf.size()) + " outlier(s), remain=" + wf.size());
            }
            double v = bykeaMaxInClosedBand(wf, 280, 560);
            if (v >= 50) return new BykeaPick(v, bykeaFirstRawForFare(wf, wr, v));
            v = bykeaMaxInClosedBand(wf, 260, 620);
            if (v >= 50) return new BykeaPick(v, bykeaFirstRawForFare(wf, wr, v));
            v = bykeaMaxInClosedBand(wf, 240, 680);
            if (v >= 50) return new BykeaPick(v, bykeaFirstRawForFare(wf, wr, v));
            v = bykeaMinInBand(pf, 260, 520);
            if (v >= 50) return new BykeaPick(v, bykeaFirstRawForFare(pf, pr, v));
            v = bykeaMaxAtMost(pf, 570);
            if (v >= 50) return new BykeaPick(v, bykeaFirstRawForFare(pf, pr, v));
            v = bykeaMaxAtMost(pf, 650);
            if (v >= 50) return new BykeaPick(v, bykeaFirstRawForFare(pf, pr, v));
        } else if ("car".equals(rt) && carAcHandoff) {
            ArrayList<Double> wfAc = new ArrayList<>();
            ArrayList<String> wrAc = new ArrayList<>();
            for (int i = 0; i < pf.size(); i++) {
                wfAc.add(pf.get(i));
                wrAc.add(pr.get(i));
            }
            bykeaStripLargestOutlierIfPlusGap(wfAc, wrAc);
            double v = bykeaMinInBand(wfAc, 560, 920);
            if (v >= 50) return new BykeaPick(v, bykeaFirstRawForFare(wfAc, wrAc, v));
            v = bykeaMaxInClosedBand(wfAc, 480, 820);
            if (v >= 50) return new BykeaPick(v, bykeaFirstRawForFare(wfAc, wrAc, v));
            v = bykeaMaxAtMost(wfAc, 780);
            if (v >= 50) return new BykeaPick(v, bykeaFirstRawForFare(wfAc, wrAc, v));
        } else if ("bike".equals(rt)) {
            double v = bykeaMinInBand(pf, 70, 220);
            if (v >= 50) return new BykeaPick(v, bykeaFirstRawForFare(pf, pr, v));
            v = bykeaMaxAtMost(pf, 240);
            if (v >= 50) return new BykeaPick(v, bykeaFirstRawForFare(pf, pr, v));
        } else if ("rickshaw".equals(rt)) {
            double v = bykeaMinInBand(pf, 200, 340);
            if (v >= 50) return new BykeaPick(v, bykeaFirstRawForFare(pf, pr, v));
            v = bykeaMaxAtMost(pf, 360);
            if (v >= 50) return new BykeaPick(v, bykeaFirstRawForFare(pf, pr, v));
        }

        double strongMax = 0;
        String strongRaw = "";
        double globalMax = 0;
        String globalRaw = "";
        for (int i = 0; i < pf.size(); i++) {
            double f = pf.get(i);
            String raw = pr.get(i);
            String s = raw.toLowerCase();
            boolean strong = s.contains("total") || s.contains("fare") || s.contains("amount")
                    || s.contains("payable") || s.contains("bill") || s.contains("charges")
                    || s.contains("pkr") || s.contains("rs.") || s.contains(" rs ") || s.contains("₨")
                    || s.contains("rupee") || s.contains("estimated") || s.contains("price");
            if (f > globalMax) {
                globalMax = f;
                globalRaw = raw;
            }
            if (strong && f > strongMax) {
                strongMax = f;
                strongRaw = raw;
            }
        }
        double pick = strongMax >= 50 ? strongMax : globalMax;
        String pickRaw = strongMax >= 50 ? strongRaw : globalRaw;
        return new BykeaPick(pick, pickRaw);
    }

    private String detectProvider(String packageName) {
        String value = packageName.toLowerCase();
        if (value.contains("yango") || value.contains("yandex.taxi")) return "Yango";
        if (value.contains("bykea") || value.contains("bykia")) return "Bykea";
        if (value.contains("indrive") || value.contains("in.drive") || value.contains("sinet")) return "InDrive";
        return null;
    }

    /** Comfort+, Premier, etc. — not "car no AC" economy tier in Farely handoff. */
    private boolean isPremiumCarTierLine(String lower) {
        if (lower == null) return false;
        if (lower.contains("car plus") || lower.contains("car  plus")) return true;
        if (lower.contains("comfort+") || lower.contains("comfort +") || lower.contains("comfortplus")) return true;
        if (lower.contains("premier") || lower.contains("premier+")) return true;
        if (lower.contains("business") || lower.contains("executive")) return true;
        if (lower.contains("luxury") || lower.contains("elite")) return true;
        if (lower.contains("first class") || lower.contains("first-class")) return true;
        return false;
    }

    private boolean fareLineAllowedForCarEconomyHandoff(String lower, String rideType, boolean carAc) {
        String rt = rideType == null ? "car" : rideType.trim().toLowerCase();
        if (!"car".equals(rt)) return true;
        if (carAc) return true;
        return !isPremiumCarTierLine(lower);
    }

    private boolean matchesBykeaRideHint(String raw, String rideType, boolean carAc) {
        if (raw == null) return true;
        String s = raw.toLowerCase();
        String rt = rideType == null ? "car" : rideType.trim().toLowerCase();
        if ("bike".equals(rt)) {
            return s.contains("bike") || s.contains("motor") || s.contains("scooter") || s.contains("2 wheel") || s.contains("two wheel");
        }
        if ("rickshaw".equals(rt)) {
            return s.contains("rick") || s.contains("rickshaw") || s.contains("tuk") || s.contains("tuktuk") || s.contains("auto") || s.contains("3 wheel");
        }
        if ("car".equals(rt)) {
            boolean bike = s.contains("bike") || s.contains("motor") || s.contains("scooter");
            boolean rick = s.contains("rick") || s.contains("rickshaw") || s.contains("tuk") || s.contains("tuktuk");
            if (bike || rick) return false;
            if (!carAc && isPremiumCarTierLine(s)) return false;
            if (carAc && (s.contains("non-ac") || s.contains("without ac") || s.contains("no ac"))) return false;
            return true;
        }
        return true;
    }

    /**
     * Drops postal codes and long address lines (e.g. \\\"… Lahore 54810\\\") mistaken for fares.
     */
    private boolean bykeaFareRowIsAddressOrPostcodeNoise(String lower, double fare) {
        if (lower == null) return false;
        boolean moneyCue = lower.contains("pkr") || lower.contains("rs.") || lower.contains(" rs ")
                || lower.contains("₨") || lower.contains("fare") || lower.contains("price")
                || lower.contains("estimated") || lower.contains("amount") || lower.contains("payable")
                || lower.contains("charges") || lower.contains(" rupee") || lower.contains("total");
        if (moneyCue) return false;
        int addrHints = 0;
        if (lower.contains(" road") || lower.contains(" rd") || lower.contains("street") || lower.contains("avenue")) {
            addrHints++;
        }
        if (lower.contains("scheme") || lower.contains("block") || lower.contains("sector") || lower.contains("phase")) {
            addrHints++;
        }
        if (lower.contains("lahore") || lower.contains("karachi") || lower.contains("islamabad")
                || lower.contains("multan") || lower.contains("rawalpindi") || lower.contains("quetta")
                || lower.contains("faisalabad") || lower.contains("peshawar") || lower.contains("sialkot")) {
            addrHints++;
        }
        if (lower.contains("town") || lower.contains("colony") || lower.contains(" chowk") || lower.contains(" pul ")) {
            addrHints++;
        }
        if (lower.length() > 36 && addrHints >= 2) return true;
        if (lower.length() > 52 && addrHints >= 1) return true;
        if (fare >= 12000 && fare <= 99999 && addrHints >= 1 && lower.length() > 28) return true;
        return false;
    }

    private void harvestBykeaFares(AccessibilityNodeInfo node, ArrayList<Double> fares, ArrayList<String> raws) {
        if (node == null) return;
        addBykeaFareCandidate(node.getText(), fares, raws);
        addBykeaFareCandidate(node.getContentDescription(), fares, raws);
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
            addBykeaFareCandidate(node.getHintText(), fares, raws);
        }
        for (int i = 0; i < node.getChildCount(); i++) {
            harvestBykeaFares(node.getChild(i), fares, raws);
        }
    }

    private void addBykeaFareCandidate(CharSequence text, ArrayList<Double> fares, ArrayList<String> raws) {
        if (text == null) return;
        String value = text.toString().trim().replace('\u00a0', ' ').replace('\u202f', ' ');
        if (value.isEmpty() || value.length() > 360) return;
        String lower = value.toLowerCase();
        Matcher matcher = FARE_PATTERN.matcher(value);
        String candidate = null;
        if (matcher.find()) {
            candidate = matcher.group(1);
        } else {
            Matcher amtFirst = FARE_PATTERN_AMOUNT_FIRST.matcher(value);
            if (amtFirst.find()) {
                candidate = amtFirst.group(1);
            }
        }
        if (candidate == null && (
                lower.contains("fare")
                || lower.contains("price")
                || lower.contains("estimate")
                || lower.contains("trip")
                || lower.contains("ride")
                || lower.contains("total")
                || lower.contains("rs")
                || lower.contains("pkr")
                || lower.contains("amount")
                || lower.contains("cost")
                || lower.contains("charge")
                || lower.contains("payable")
                || lower.contains("bill")
                || lower.contains("rupee")
                || lower.contains("bykea")
                || lower.contains("captain")
        )) {
            Matcher fallback = FALLBACK_NUMBER_PATTERN.matcher(value);
            double best = -1;
            String bestCand = null;
            while (fallback.find()) {
                String c = fallback.group(1);
                try {
                    double f = Double.parseDouble(c.replace(",", "").replace(" ", "").replace("\u00a0", "").replace("\u202f", ""));
                    if (f >= 50 && f <= 100000 && f > best) {
                        best = f;
                        bestCand = c;
                    }
                } catch (Exception ignored) {}
            }
            if (bestCand != null) {
                candidate = bestCand;
            }
        }
        if (candidate != null) {
            addParsedFare(candidate, value, fares, raws);
            return;
        }
        if (bykeaFareRowIsAddressOrPostcodeNoise(lower, 0) && !moneyCueLine(lower)) {
            return;
        }
        if (value.length() <= 120 && value.replaceAll("[^0-9.,]", "").length() >= 3) {
            Matcher loose = BYKEA_STANDALONE_MONEY.matcher(value);
            while (loose.find()) {
                addParsedFare(loose.group(1), value, fares, raws);
            }
        }
    }

    private boolean moneyCueLine(String lower) {
        return lower.contains("pkr") || lower.contains("rs.") || lower.contains(" rs ") || lower.contains("₨")
                || lower.contains("fare") || lower.contains("price") || lower.contains("estimated")
                || lower.contains("amount") || lower.contains("total") || lower.contains("payable");
    }

    private void addParsedFare(String candidate, String rawLine, ArrayList<Double> fares, ArrayList<String> raws) {
        if (candidate == null) return;
        String normalized = candidate.replace(",", "").replace(" ", "").replace("\u00a0", "").replace("\u202f", "");
        try {
            double fare = Double.parseDouble(normalized);
            if (fare >= 50 && fare <= 100000) {
                fares.add(fare);
                raws.add(rawLine);
            }
        } catch (Exception ignored) {}
    }

    private void traverseNode(AccessibilityNodeInfo node, String provider, String rideHandoff, boolean carAcHandoff) {
        if (node == null) return;

        tryExtractFare(node.getText(), provider, rideHandoff, carAcHandoff);
        tryExtractFare(node.getContentDescription(), provider, rideHandoff, carAcHandoff);
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
            tryExtractFare(node.getHintText(), provider, rideHandoff, carAcHandoff);
        }

        for (int i = 0; i < node.getChildCount(); i++) {
            traverseNode(node.getChild(i), provider, rideHandoff, carAcHandoff);
        }
    }

    private void tryExtractFare(CharSequence text, String provider, String rideHandoff, boolean carAcHandoff) {
        if (text == null) return;

        String value = text.toString().trim().replace('\u00a0', ' ').replace('\u202f', ' ');
        if (value.isEmpty()) return;
        String lower = value.toLowerCase();
        if ("Yango".equals(provider) && !fareLineAllowedForCarEconomyHandoff(lower, rideHandoff, carAcHandoff)) {
            return;
        }
        Matcher matcher = FARE_PATTERN.matcher(value);
        String candidate = null;
        if (matcher.find()) {
            candidate = matcher.group(1);
        } else {
            Matcher amtFirst = FARE_PATTERN_AMOUNT_FIRST.matcher(value);
            if (amtFirst.find()) {
                candidate = amtFirst.group(1);
            }
        }
        if (candidate == null && (
                lower.contains("fare")
                || lower.contains("price")
                || lower.contains("estimate")
                || lower.contains("trip")
                || lower.contains("ride")
                || lower.contains("total")
                || lower.contains("rs")
                || lower.contains("pkr")
                || lower.contains("amount")
                || lower.contains("cost")
                || lower.contains("charge")
                || lower.contains("payable")
                || lower.contains("bill")
                || lower.contains("rupee")
                || lower.contains("service class")
                || lower.contains("discounted")
                || lower.contains("pickup")
        )) {
            Matcher fallback = FALLBACK_NUMBER_PATTERN.matcher(value);
            double best = -1;
            String bestCand = null;
            while (fallback.find()) {
                String c = fallback.group(1);
                try {
                    double f = Double.parseDouble(c.replace(",", "").replace(" ", "").replace("\u00a0", "").replace("\u202f", ""));
                    if (f >= 40 && f <= 50000 && f > best) {
                        best = f;
                        bestCand = c;
                    }
                } catch (Exception ignored) {}
            }
            if (bestCand != null) {
                candidate = bestCand;
            }
        }

        if (candidate == null) return;

        String normalized = candidate.replace(",", "").replace(" ", "").replace("\u00a0", "").replace("\u202f", "");
        try {
            double fare = Double.parseDouble(normalized);
            if (fare >= 40 && fare <= 50000) {
                Log.d("UI_DATA", provider + " fare: " + fare + " from " + value);
                FareAccessibilityEmitter.emit(this, provider, fare, value);
                FareAccessibilityEmitter.emitDebug(this, provider + ": matched fare " + Math.round(fare));
            }
        } catch (Exception ignored) {}
    }

    @Override
    public void onInterrupt() {}
}
`;

  const moduleSource = `package ${packageName};

import androidx.annotation.NonNull;
import com.facebook.react.bridge.Arguments;
import android.content.Context;
import android.content.SharedPreferences;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.modules.core.DeviceEventManagerModule;

public class FareAccessibilityModule extends ReactContextBaseJavaModule {
    private static ReactApplicationContext reactContextRef;
    private static long lastEmitAtMs = 0;
    private static String lastSignature = "";

    public FareAccessibilityModule(ReactApplicationContext reactContext) {
        super(reactContext);
        reactContextRef = reactContext;
    }

    @NonNull
    @Override
    public String getName() {
        return "FareAccessibilityModule";
    }

    @ReactMethod
    public void setCaptureHandoff(String rideType, boolean carAc) {
        try {
            SharedPreferences sp = getReactApplicationContext().getSharedPreferences("farely_accessibility", Context.MODE_PRIVATE);
            sp.edit()
                    .putString("ride_type", rideType == null || rideType.isEmpty() ? "car" : rideType)
                    .putBoolean("car_ac", carAc)
                    .apply();
        } catch (Exception ignored) {}
    }

    public static void emitUiData(String provider, double fare, String rawText) {
        if (reactContextRef == null || !reactContextRef.hasActiveReactInstance()) return;
        if (fare <= 0) return;

        String signature = provider + ":" + fare + ":" + rawText;
        long now = System.currentTimeMillis();
        if (signature.equals(lastSignature) && (now - lastEmitAtMs) < 1200) {
            return;
        }
        lastSignature = signature;
        lastEmitAtMs = now;

        WritableMap map = Arguments.createMap();
        map.putString("provider", provider);
        map.putDouble("fare", fare);
        map.putString("rawText", rawText);

        reactContextRef
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                .emit("UI_DATA", map);
    }
}
`;

  const packageSource = `package ${packageName};

import com.facebook.react.ReactPackage;
import com.facebook.react.bridge.NativeModule;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.uimanager.ViewManager;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

public class FareAccessibilityPackage implements ReactPackage {
    @Override
    public List<NativeModule> createNativeModules(ReactApplicationContext reactContext) {
        List<NativeModule> modules = new ArrayList<>();
        modules.add(new FareAccessibilityModule(reactContext));
        return modules;
    }

    @Override
    public List<ViewManager> createViewManagers(ReactApplicationContext reactContext) {
        return Collections.emptyList();
    }
}
`;

  const emitterSource = `package ${packageName};

import android.content.Context;
import com.facebook.react.ReactApplication;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.ReactContext;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.modules.core.DeviceEventManagerModule;

public class FareAccessibilityEmitter {
    private static long lastDebugEmitAtMs = 0;

    public static void emit(Context context, String provider, double fare, String rawText) {
        if (context == null || fare <= 0) return;
        if (!(context.getApplicationContext() instanceof ReactApplication)) return;

        ReactApplication app = (ReactApplication) context.getApplicationContext();
        ReactContext reactContext = app.getReactNativeHost().getReactInstanceManager().getCurrentReactContext();
        if (reactContext == null || !reactContext.hasActiveReactInstance()) return;

        WritableMap map = Arguments.createMap();
        map.putString("provider", provider);
        map.putDouble("fare", fare);
        map.putString("rawText", rawText);
        reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                .emit("UI_DATA", map);
    }

    public static void emitDebug(Context context, String message) {
        if (context == null || message == null || message.trim().isEmpty()) return;
        if (!(context.getApplicationContext() instanceof ReactApplication)) return;
        long now = System.currentTimeMillis();
        if ((now - lastDebugEmitAtMs) < 450) return;
        lastDebugEmitAtMs = now;

        ReactApplication app = (ReactApplication) context.getApplicationContext();
        ReactContext reactContext = app.getReactNativeHost().getReactInstanceManager().getCurrentReactContext();
        if (reactContext == null || !reactContext.hasActiveReactInstance()) return;

        WritableMap map = Arguments.createMap();
        map.putString("message", message);
        map.putDouble("ts", now);
        reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                .emit("UI_DATA_DEBUG", map);
    }
}
`;

  const xmlSource = `<accessibility-service xmlns:android="http://schemas.android.com/apk/res/android"
    android:accessibilityEventTypes="typeWindowContentChanged|typeViewClicked|typeWindowStateChanged|typeWindowsChanged|typeViewTextChanged"
    android:accessibilityFeedbackType="feedbackGeneric"
    android:notificationTimeout="100"
    android:canRetrieveWindowContent="true"
    android:accessibilityFlags="flagReportViewIds|flagRetrieveInteractiveWindows" />
`;

  await Promise.all([
    fs.writeFile(serviceFile, serviceSource),
    fs.writeFile(moduleFile, moduleSource),
    fs.writeFile(packageFile, packageSource),
    fs.writeFile(path.join(packageDir, "FareAccessibilityEmitter.java"), emitterSource),
    fs.writeFile(xmlFile, xmlSource),
  ]);
}

const withFareAccessibilityService = (config) => {
  config = withAndroidManifest(config, (modConfig) => {
    modConfig.modResults = ensureServiceInManifest(modConfig.modResults);
    return modConfig;
  });

  config = withDangerousMod(config, [
    "android",
    async (modConfig) => {
      const packageName = modConfig.android?.package;
      if (!packageName) return modConfig;

      const packagePath = packageName.replaceAll(".", "/");
      const javaRoot = path.join(
        modConfig.modRequest.platformProjectRoot,
        "app",
        "src",
        "main",
        "java"
      );

      await createNativeFiles(javaRoot, packagePath, packageName);
      await patchMainApplication(javaRoot, packagePath);
      return modConfig;
    },
  ]);

  return config;
};

module.exports = createRunOncePlugin(
  withFareAccessibilityService,
  "with-fare-accessibility-service",
  "1.0.0"
);
