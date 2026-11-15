---
type: baseline-report
card: P8-01
status: current
last_updated: 2026-11-15
generated_at: 2026-11-15T02:47:25Z
commit: a4a9b5b69f3bda2d3eb8d1af11c0fb4017903b8c
---

## 掃描結果總覽

| 指標         | 數值 |
| ------------ | ---- |
| 掃描檔案數   | 150  |
| 違規行數     | 156  |
| 違規出現次數 | 156  |
| 涉及檔案數   | 37   |

## 違規分佈（按檔案）

| 檔案                                             | 行數 | 出現次數 | 主要類型                          |
| ------------------------------------------------ | ---- | -------- | --------------------------------- |
| src/components/FloatingPill.vue                  | 2    | 2        | rgba（邊框 / 陰影）               |
| src/components/chart/TechnicalPanel.vue          | 2    | 2        | rgba（背景）                      |
| src/components/common/AuthExpiredModal.vue       | 2    | 2        | rgba（背景 / 陰影）               |
| src/components/common/EmptyState.test.js         | 2    | 2        | hex（測試）                       |
| src/components/common/Icon.test.js               | 2    | 2        | hex（測試）                       |
| src/components/dashboard/CoachingAdvice.test.js  | 1    | 1        | rgba（註解）                      |
| src/components/dashboard/MetricItem.vue          | 1    | 1        | rgba（邊框）                      |
| src/components/macro/SocialSentimentCard.vue     | 1    | 1        | rgba（背景）                      |
| src/components/radar/ExtremeRadarPanel.vue       | 20   | 20       | rgba（背景 / 邊框 / 註解）        |
| src/components/theory/CrashToleranceDetail.vue   | 5    | 5        | rgba（背景）                      |
| src/components/theory/CrashToleranceSummary.vue  | 6    | 6        | rgba（背景 / 邊框）               |
| src/components/theory/ExposureDetail.vue         | 1    | 1        | rgba（背景）                      |
| src/components/theory/ExposureSummary.vue        | 5    | 5        | rgba（背景）                      |
| src/components/theory/HumanCapitalDetail.vue     | 5    | 5        | rgba（背景）                      |
| src/components/theory/HumanCapitalSummary.vue    | 6    | 6        | rgba（背景 / 邊框）               |
| src/components/theory/InputDataDetail.vue        | 2    | 2        | rgba（背景）                      |
| src/components/theory/InputDataSummary.vue       | 1    | 1        | rgba（背景）                      |
| src/components/theory/KellyLeverageDetail.vue    | 5    | 5        | rgba（背景）                      |
| src/components/theory/KellyLeverageSummary.vue   | 5    | 5        | rgba（背景 / 邊框）               |
| src/components/theory/LaplaceDetail.vue          | 7    | 7        | rgba（背景 / 邊框）               |
| src/components/theory/LaplaceSummary.vue         | 7    | 7        | rgba（背景 / 邊框）               |
| src/components/theory/LifecycleDetail.vue        | 4    | 4        | rgba（背景）                      |
| src/components/theory/LifecycleSummary.vue       | 1    | 1        | rgba（背景）                      |
| src/components/theory/TobinSeparationDetail.vue  | 7    | 7        | rgba（背景 / 邊框）               |
| src/components/theory/TobinSeparationSummary.vue | 6    | 6        | rgba（背景 / 邊框）               |
| src/components/theory/TrueExposureDetail.vue     | 5    | 5        | rgba（背景）                      |
| src/components/theory/TrueExposureSummary.vue    | 6    | 6        | rgba（背景 / 邊框）               |
| src/composables/useTelegram.js                   | 2    | 2        | hex（內聯樣式）                   |
| src/composables/useTelegram.test.js              | 12   | 12       | hex（測試）                       |
| src/main.js                                      | 2    | 2        | hex / var fallback（內聯樣式）    |
| src/utils/exportUtility.js                       | 1    | 1        | hex（var fallback）               |
| src/views/AccountView.vue                        | 11   | 11       | rgba（邊框 / 陰影 / 背景）        |
| src/views/DashboardView.vue                      | 1    | 1        | rgba（陰影）                      |
| src/views/MacroBattleView.vue                    | 1    | 1        | rgba（漸變）                      |
| src/views/MarketRadarView.vue                    | 5    | 5        | rgba（漸變 / 背景 / 邊框 / 陰影） |
| src/views/TechnicalView.vue                      | 2    | 2        | rgba（背景）                      |
| src/views/TheoryView.vue                         | 1    | 1        | rgba（背景）                      |

## 與既有機制的差異比對

| 機制                         | 判定對象                     | 數量 |
| ---------------------------- | ---------------------------- | ---- |
| check-no-hex.mjs（舊）       | `.vue` `<style>` 內 hex      | 0    |
| hex-audit-guard.test.js      | 全檔 hex（行數，含排除規則） | 24   |
| check-no-raw-color.mjs（新） | 全色彩字面量（行數）         | 156  |
| check-no-raw-color.mjs（新） | 全色彩字面量（出現次數）     | 156  |

**差異說明**：新機制多攔截 rgba()/rgb()/hsl() 色彩函數（156 處中絕大部分為 rgba），且掃描範圍擴及 .js/.mjs 全文；hex-audit-guard 排除 var fallback 與註解業務語義色，且按行計數（每行多個 hex 只算 1 處），故數字遠低於新機制。

## hex-audit-guard 計數口徑核實

| 口徑                           | 數值                                                    |
| ------------------------------ | ------------------------------------------------------- |
| 現行 guard（按行，含排除規則） | 24                                                      |
| 按出現次數（含排除規則）       | 24                                                      |
| 差異主因                       | 無差異（每行最多僅含 1 個 hex 色值，無多 hex 同行情況） |

結論：guard 無需改為按出現次數計數。
建議：否，理由：當前 codebase 中無同行多個 hex 色值的情況，按行與按次數結果一致。

## rgba / rgb / hsl 完整清單（P8-02 施工依據）

| #   | 檔案:行                        | 原始碼                                                                      | 建議處置                              | 對應令牌（若已知） |
| --- | ------------------------------ | --------------------------------------------------------------------------- | ------------------------------------- | ------------------ |
| 1   | FloatingPill.vue:152           | `border-color: rgba(255, 255, 255, 0.1);`                                   | 改用既有令牌                          | 待確認             |
| 2   | FloatingPill.vue:153           | `box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);`                                | 需新增令牌                            | ⚠️ 需新增覆寫      |
| 3   | TechnicalPanel.vue:691         | `background: rgba(232, 72, 85, 0.08);`                                      | 需新增令牌                            | ⚠️ 需新增覆寫      |
| 4   | TechnicalPanel.vue:694         | `background: rgba(0, 0, 0, 0.03);`                                          | 需新增令牌                            | ⚠️ 需新增覆寫      |
| 5   | AuthExpiredModal.vue:35        | `background-color: rgba(0, 0, 0, 0.65);`                                    | 需新增令牌                            | ⚠️ 需新增覆寫      |
| 6   | AuthExpiredModal.vue:52        | `box-shadow: 0 12px 32px rgba(0, 0, 0, 0.25);`                              | 需新增令牌                            | ⚠️ 需新增覆寫      |
| 7   | EmptyState.test.js:51          | `iconColor: "#ff0000",`                                                     | 加行內允許（測試假資料）              | N/A                |
| 8   | EmptyState.test.js:57          | `expect(wrapper.props("iconColor")).toBe("#ff0000");`                       | 加行內允許（測試假資料）              | N/A                |
| 9   | Icon.test.js:50                | `const wrapper = mount(Icon, { props: { name: "ok", color: "#ff0000" } });` | 加行內允許（測試假資料）              | N/A                |
| 10  | Icon.test.js:52                | `expect(svg.attributes("fill")).toBe("#ff0000");`                           | 加行內允許（測試假資料）              | N/A                |
| 11  | CoachingAdvice.test.js:54      | `it("移除舊的 rgba(0,0,0,0.07) 硬編碼邊框", () => {`                        | 加行內允許（測試註解）                | N/A                |
| 12  | MetricItem.vue:41              | `border: 1px solid rgba(0,0,0,0.06);`                                       | 改用既有令牌                          | 待確認             |
| 13  | SocialSentimentCard.vue:393    | `background: rgba(0, 0, 0, 0.35);`                                          | 需新增令牌                            | ⚠️ 需新增覆寫      |
| 14  | ExtremeRadarPanel.vue:344      | `box-shadow: 0 1px 4px rgba(0, 0, 0, 0.02);`                                | 需新增令牌                            | ⚠️ 需新增覆寫      |
| 15  | ExtremeRadarPanel.vue:435      | `background: rgba(0, 0, 0, 0.04);`                                          | 需新增令牌                            | ⚠️ 需新增覆寫      |
| 16  | ExtremeRadarPanel.vue:437      | `border: 1px solid rgba(0, 0, 0, 0.06);`                                    | 改用既有令牌                          | 待確認             |
| 17  | ExtremeRadarPanel.vue:442      | `background: rgba(0, 0, 0, 0.08);`                                          | 需新增令牌                            | ⚠️ 需新增覆寫      |
| 18  | ExtremeRadarPanel.vue:459      | `background: rgba(255, 255, 255, 0.7);`                                     | 需新增令牌                            | ⚠️ 需新增覆寫      |
| 19  | ExtremeRadarPanel.vue:511      | `background: rgba(0, 0, 0, 0.04);`                                          | 需新增令牌                            | ⚠️ 需新增覆寫      |
| 20  | ExtremeRadarPanel.vue:616      | `background: rgba(255, 255, 255, 0.7);`                                     | 需新增令牌                            | ⚠️ 需新增覆寫      |
| 21  | ExtremeRadarPanel.vue:676      | `background: rgba(255, 255, 255, 0.7);`                                     | 需新增令牌                            | ⚠️ 需新增覆寫      |
| 22  | ExtremeRadarPanel.vue:682      | `border: 1px solid rgba(0, 0, 0, 0.05);`                                    | 改用既有令牌                          | 待確認             |
| 23  | ExtremeRadarPanel.vue:732      | `background: rgba(255, 255, 255, 0.05);`                                    | 需新增令牌                            | ⚠️ 需新增覆寫      |
| 24  | ExtremeRadarPanel.vue:733      | `border-color: rgba(255, 255, 255, 0.08);`                                  | 改用既有令牌                          | 待確認             |
| 25  | ExtremeRadarPanel.vue:760      | `background: rgba(255, 255, 255, 0.08);`                                    | 需新增令牌                            | ⚠️ 需新增覆寫      |
| 26  | ExtremeRadarPanel.vue:761      | `border-color: rgba(255, 255, 255, 0.12);`                                  | 改用既有令牌                          | 待確認             |
| 27  | ExtremeRadarPanel.vue:768      | `background: rgba(255, 255, 255, 0.08);`                                    | 需新增令牌                            | ⚠️ 需新增覆寫      |
| 28  | ExtremeRadarPanel.vue:777      | `background: rgba(255, 255, 255, 0.05);`                                    | 需新增令牌                            | ⚠️ 需新增覆寫      |
| 29  | ExtremeRadarPanel.vue:778      | `border-color: rgba(255, 255, 255, 0.08);`                                  | 改用既有令牌                          | 待確認             |
| 30  | ExtremeRadarPanel.vue:781      | `/* .radar-panel-idle box-shadow: rgba(0,0,0,0.02) — 極淡陰影 */`           | 加行內允許（註解）                    | N/A                |
| 31  | ExtremeRadarPanel.vue:783      | `/* .radar-mini-item background: rgba(255,255,255,0.7) — 半透明卡片設計 */` | 加行內允許（註解）                    | N/A                |
| 32  | ExtremeRadarPanel.vue:784      | `/* .dark .toggle-btn background: rgba(0,0,0,0.04) — 深色專用 */`           | 加行內允許（註解）                    | N/A                |
| 33  | ExtremeRadarPanel.vue:785      | `/* .dark .mini-desc background: rgba(255,255,255,0.08) — 深色專用 */`      | 加行內允許（註解）                    | N/A                |
| 34  | CrashToleranceDetail.vue:292   | `background: rgba(46, 125, 50, 0.1);`                                       | 需新增令牌                            | ⚠️ 需新增覆寫      |
| 35  | CrashToleranceDetail.vue:297   | `background: rgba(239, 108, 0, 0.1);`                                       | 需新增令牌                            | ⚠️ 需新增覆寫      |
| 36  | CrashToleranceDetail.vue:302   | `background: rgba(198, 40, 40, 0.1);`                                       | 需新增令牌                            | ⚠️ 需新增覆寫      |
| 37  | CrashToleranceDetail.vue:337   | `background: rgba(239, 108, 0, 0.1);`                                       | 需新增令牌                            | ⚠️ 需新增覆寫      |
| 38  | CrashToleranceDetail.vue:342   | `background: rgba(158, 158, 158, 0.1);`                                     | 需新增令牌                            | ⚠️ 需新增覆寫      |
| 39  | CrashToleranceSummary.vue:87   | `background: rgba(46, 125, 50, 0.1);`                                       | 需新增令牌                            | ⚠️ 需新增覆寫      |
| 40  | CrashToleranceSummary.vue:89   | `border: 1px solid rgba(46, 125, 50, 0.3);`                                 | 改用既有令牌                          | 待確認             |
| 41  | CrashToleranceSummary.vue:93   | `background: rgba(198, 40, 40, 0.1);`                                       | 需新增令牌                            | ⚠️ 需新增覆寫      |
| 42  | CrashToleranceSummary.vue:95   | `border: 1px solid rgba(198, 40, 40, 0.3);`                                 | 改用既有令牌                          | 待確認             |
| 43  | CrashToleranceSummary.vue:99   | `background: rgba(239, 108, 0, 0.1);`                                       | 需新增令牌                            | ⚠️ 需新增覆寫      |
| 44  | CrashToleranceSummary.vue:101  | `border: 1px solid rgba(239, 108, 0, 0.3);`                                 | 改用既有令牌                          | 待確認             |
| 45  | ExposureDetail.vue:605         | `background: rgba(158, 158, 158, 0.1);`                                     | 需新增令牌                            | ⚠️ 需新增覆寫      |
| 46  | ExposureSummary.vue:263        | `background: rgba(76, 175, 80, 0.1);`                                       | 需新增令牌                            | ⚠️ 需新增覆寫      |
| 47  | ExposureSummary.vue:268        | `background: rgba(255, 152, 0, 0.1);`                                       | 需新增令牌                            | ⚠️ 需新增覆寫      |
| 48  | ExposureSummary.vue:273        | `background: rgba(255, 87, 34, 0.1);`                                       | 需新增令牌                            | ⚠️ 需新增覆寫      |
| 49  | ExposureSummary.vue:278        | `background: rgba(244, 67, 54, 0.1);`                                       | 需新增令牌                            | ⚠️ 需新增覆寫      |
| 50  | ExposureSummary.vue:283        | `background: rgba(158, 158, 158, 0.1);`                                     | 需新增令牌                            | ⚠️ 需新增覆寫      |
| 51  | HumanCapitalDetail.vue:292     | `background: rgba(46, 125, 50, 0.1);`                                       | 需新增令牌                            | ⚠️ 需新增覆寫      |
| 52  | HumanCapitalDetail.vue:297     | `background: rgba(239, 108, 0, 0.1);`                                       | 需新增令牌                            | ⚠️ 需新增覆寫      |
| 53  | HumanCapitalDetail.vue:302     | `background: rgba(198, 40, 40, 0.1);`                                       | 需新增令牌                            | ⚠️ 需新增覆寫      |
| 54  | HumanCapitalDetail.vue:337     | `background: rgba(239, 108, 0, 0.1);`                                       | 需新增令牌                            | ⚠️ 需新增覆寫      |
| 55  | HumanCapitalDetail.vue:342     | `background: rgba(158, 158, 158, 0.1);`                                     | 需新增令牌                            | ⚠️ 需新增覆寫      |
| 56  | HumanCapitalSummary.vue:87     | `background: rgba(46, 125, 50, 0.1);`                                       | 需新增令牌                            | ⚠️ 需新增覆寫      |
| 57  | HumanCapitalSummary.vue:89     | `border: 1px solid rgba(46, 125, 50, 0.3);`                                 | 改用既有令牌                          | 待確認             |
| 58  | HumanCapitalSummary.vue:93     | `background: rgba(198, 40, 40, 0.1);`                                       | 需新增令牌                            | ⚠️ 需新增覆寫      |
| 59  | HumanCapitalSummary.vue:95     | `border: 1px solid rgba(198, 40, 40, 0.3);`                                 | 改用既有令牌                          | 待確認             |
| 60  | HumanCapitalSummary.vue:99     | `background: rgba(239, 108, 0, 0.1);`                                       | 需新增令牌                            | ⚠️ 需新增覆寫      |
| 61  | HumanCapitalSummary.vue:101    | `border: 1px solid rgba(239, 108, 0, 0.3);`                                 | 改用既有令牌                          | 待確認             |
| 62  | InputDataDetail.vue:394        | `background: rgba(76, 175, 80, 0.15);`                                      | 需新增令牌                            | ⚠️ 需新增覆寫      |
| 63  | InputDataDetail.vue:593        | `background: rgba(158, 158, 158, 0.1);`                                     | 需新增令牌                            | ⚠️ 需新增覆寫      |
| 64  | InputDataSummary.vue:200       | `background: rgba(51, 144, 236, 0.08);`                                     | 需新增令牌                            | ⚠️ 需新增覆寫      |
| 65  | KellyLeverageDetail.vue:378    | `background: rgba(76, 175, 80, 0.1);`                                       | 需新增令牌                            | ⚠️ 需新增覆寫      |
| 66  | KellyLeverageDetail.vue:383    | `background: rgba(255, 152, 0, 0.1);`                                       | 需新增令牌                            | ⚠️ 需新增覆寫      |
| 67  | KellyLeverageDetail.vue:388    | `background: rgba(244, 67, 54, 0.1);`                                       | 需新增令牌                            | ⚠️ 需新增覆寫      |
| 68  | KellyLeverageDetail.vue:481    | `background: rgba(255, 152, 0, 0.1);`                                       | 需新增令牌                            | ⚠️ 需新增覆寫      |
| 69  | KellyLeverageDetail.vue:486    | `background: rgba(158, 158, 158, 0.1);`                                     | 需新增令牌                            | ⚠️ 需新增覆寫      |
| 70  | KellyLeverageSummary.vue:347   | `background: rgba(76, 175, 80, 0.1);`                                       | 需新增令牌                            | ⚠️ 需新增覆寫      |
| 71  | KellyLeverageSummary.vue:352   | `background: rgba(255, 152, 0, 0.1);`                                       | 需新增令牌                            | ⚠️ 需新增覆寫      |
| 72  | KellyLeverageSummary.vue:357   | `background: rgba(244, 67, 54, 0.1);`                                       | 需新增令牌                            | ⚠️ 需新增覆寫      |
| 73  | KellyLeverageSummary.vue:362   | `background: rgba(158, 158, 158, 0.1);`                                     | 需新增令牌                            | ⚠️ 需新增覆寫      |
| 74  | KellyLeverageSummary.vue:396   | `border: 1px solid rgba(0, 0, 0, 0.06);`                                    | 改用既有令牌                          | 待確認             |
| 75  | LaplaceDetail.vue:170          | `background: rgba(128, 128, 128, 0.1);`                                     | 需新增令牌                            | ⚠️ 需新增覆寫      |
| 76  | LaplaceDetail.vue:214          | `background: rgba(128, 128, 128, 0.05);`                                    | 需新增令牌                            | ⚠️ 需新增覆寫      |
| 77  | LaplaceDetail.vue:236          | `background: rgba(128, 128, 128, 0.05);`                                    | 需新增令牌                            | ⚠️ 需新增覆寫      |
| 78  | LaplaceDetail.vue:285          | `background: rgba(128, 128, 128, 0.05);`                                    | 需新增令牌                            | ⚠️ 需新增覆寫      |
| 79  | LaplaceDetail.vue:311          | `background: rgba(128, 128, 128, 0.05);`                                    | 需新增令牌                            | ⚠️ 需新增覆寫      |
| 80  | LaplaceDetail.vue:330          | `background: rgba(255, 152, 0, 0.05);`                                      | 需新增令牌                            | ⚠️ 需新增覆寫      |
| 81  | LaplaceDetail.vue:331          | `border: 1px solid rgba(255, 152, 0, 0.2);`                                 | 改用既有令牌                          | 待確認             |
| 82  | LaplaceSummary.vue:99          | `background: rgba(128, 128, 128, 0.1);`                                     | 需新增令牌                            | ⚠️ 需新增覆寫      |
| 83  | LaplaceSummary.vue:145         | `background: rgba(76, 175, 80, 0.1);`                                       | 需新增令牌                            | ⚠️ 需新增覆寫      |
| 84  | LaplaceSummary.vue:147         | `border: 1px solid rgba(76, 175, 80, 0.3);`                                 | 改用既有令牌                          | 待確認             |
| 85  | LaplaceSummary.vue:151         | `background: rgba(255, 152, 0, 0.1);`                                       | 需新增令牌                            | ⚠️ 需新增覆寫      |
| 86  | LaplaceSummary.vue:153         | `border: 1px solid rgba(255, 152, 0, 0.3);`                                 | 改用既有令牌                          | 待確認             |
| 87  | LaplaceSummary.vue:157         | `background: rgba(158, 158, 158, 0.1);`                                     | 需新增令牌                            | ⚠️ 需新增覆寫      |
| 88  | LaplaceSummary.vue:159         | `border: 1px solid rgba(158, 158, 158, 0.3);`                               | 改用既有令牌                          | 待確認             |
| 89  | LifecycleDetail.vue:458        | `background: rgba(51, 144, 236, 0.05);`                                     | 需新增令牌                            | ⚠️ 需新增覆寫      |
| 90  | LifecycleDetail.vue:504        | `background: rgba(76, 175, 80, 0.08);`                                      | 需新增令牌                            | ⚠️ 需新增覆寫      |
| 91  | LifecycleDetail.vue:548        | `background: rgba(255, 152, 0, 0.1);`                                       | 需新增令牌                            | ⚠️ 需新增覆寫      |
| 92  | LifecycleDetail.vue:553        | `background: rgba(158, 158, 158, 0.1);`                                     | 需新增令牌                            | ⚠️ 需新增覆寫      |
| 93  | LifecycleSummary.vue:255       | `background: rgba(51, 144, 236, 0.08);`                                     | 需新增令牌                            | ⚠️ 需新增覆寫      |
| 94  | TobinSeparationDetail.vue:162  | `background: rgba(128, 128, 128, 0.1);`                                     | 需新增令牌                            | ⚠️ 需新增覆寫      |
| 95  | TobinSeparationDetail.vue:206  | `background: rgba(128, 128, 128, 0.05);`                                    | 需新增令牌                            | ⚠️ 需新增覆寫      |
| 96  | TobinSeparationDetail.vue:228  | `background: rgba(128, 128, 128, 0.05);`                                    | 需新增令牌                            | ⚠️ 需新增覆寫      |
| 97  | TobinSeparationDetail.vue:277  | `background: rgba(128, 128, 128, 0.05);`                                    | 需新增令牌                            | ⚠️ 需新增覆寫      |
| 98  | TobinSeparationDetail.vue:303  | `background: rgba(128, 128, 128, 0.05);`                                    | 需新增令牌                            | ⚠️ 需新增覆寫      |
| 99  | TobinSeparationDetail.vue:322  | `background: rgba(255, 152, 0, 0.05);`                                      | 需新增令牌                            | ⚠️ 需新增覆寫      |
| 100 | TobinSeparationDetail.vue:323  | `border: 1px solid rgba(255, 152, 0, 0.2);`                                 | 改用既有令牌                          | 待確認             |
| 101 | TobinSeparationSummary.vue:99  | `background: rgba(128, 128, 128, 0.1);`                                     | 需新增令牌                            | ⚠️ 需新增覆寫      |
| 102 | TobinSeparationSummary.vue:145 | `background: rgba(76, 175, 80, 0.1);`                                       | 需新增令牌                            | ⚠️ 需新增覆寫      |
| 103 | TobinSeparationSummary.vue:147 | `border: 1px solid rgba(76, 175, 80, 0.3);`                                 | 改用既有令牌                          | 待確認             |
| 104 | TobinSeparationSummary.vue:151 | `background: rgba(255, 152, 0, 0.1);`                                       | 需新增令牌                            | ⚠️ 需新增覆寫      |
| 105 | TobinSeparationSummary.vue:153 | `border: 1px solid rgba(255, 152, 0, 0.3);`                                 | 改用既有令牌                          | 待確認             |
| 106 | TobinSeparationSummary.vue:157 | `background: rgba(158, 158, 158, 0.1);`                                     | 需新增令牌                            | ⚠️ 需新增覆寫      |
| 107 | TobinSeparationSummary.vue:159 | `border: 1px solid rgba(158, 158, 158, 0.3);`                               | 改用既有令牌                          | 待確認             |
| 108 | TrueExposureDetail.vue:292     | `background: rgba(46, 125, 50, 0.1);`                                       | 需新增令牌                            | ⚠️ 需新增覆寫      |
| 109 | TrueExposureDetail.vue:297     | `background: rgba(239, 108, 0, 0.1);`                                       | 需新增令牌                            | ⚠️ 需新增覆寫      |
| 110 | TrueExposureDetail.vue:302     | `background: rgba(198, 40, 40, 0.1);`                                       | 需新增令牌                            | ⚠️ 需新增覆寫      |
| 111 | TrueExposureDetail.vue:337     | `background: rgba(239, 108, 0, 0.1);`                                       | 需新增令牌                            | ⚠️ 需新增覆寫      |
| 112 | TrueExposureDetail.vue:342     | `background: rgba(158, 158, 158, 0.1);`                                     | 需新增令牌                            | ⚠️ 需新增覆寫      |
| 113 | TrueExposureSummary.vue:87     | `background: rgba(46, 125, 50, 0.1);`                                       | 需新增令牌                            | ⚠️ 需新增覆寫      |
| 114 | TrueExposureSummary.vue:89     | `border: 1px solid rgba(46, 125, 50, 0.3);`                                 | 改用既有令牌                          | 待確認             |
| 115 | TrueExposureSummary.vue:93     | `background: rgba(198, 40, 40, 0.1);`                                       | 需新增令牌                            | ⚠️ 需新增覆寫      |
| 116 | TrueExposureSummary.vue:95     | `border: 1px solid rgba(198, 40, 40, 0.3);`                                 | 改用既有令牌                          | 待確認             |
| 117 | TrueExposureSummary.vue:99     | `background: rgba(239, 108, 0, 0.1);`                                       | 需新增令牌                            | ⚠️ 需新增覆寫      |
| 118 | TrueExposureSummary.vue:101    | `border: 1px solid rgba(239, 108, 0, 0.3);`                                 | 改用既有令牌                          | 待確認             |
| 119 | useTelegram.js:117             | `? "#1a1a1a"`                                                               | 加行內允許（業務語義：Telegram 主題） | N/A                |
| 120 | useTelegram.js:118             | `: "#ffffff";`                                                              | 加行內允許（業務語義：Telegram 主題） | N/A                |
| 121 | useTelegram.test.js:34         | `themeParams: { bg_color: "#fff" },`                                        | 加行內允許（測試假資料）              | N/A                |
| 122 | useTelegram.test.js:44         | `expect(telegram.themeParams).toEqual({ bg_color: "#fff" });`               | 加行內允許（測試假資料）              | N/A                |
| 123 | useTelegram.test.js:113        | `value.setHeaderColor("#2481cc");`                                          | 加行內允許（測試假資料）              | N/A                |
| 124 | useTelegram.test.js:115        | `"#2481cc",`                                                                | 加行內允許（測試假資料）              | N/A                |
| 125 | useTelegram.test.js:122        | `value.setBackgroundColor("#000000");`                                      | 加行內允許（測試假資料）              | N/A                |
| 126 | useTelegram.test.js:124        | `"#000000",`                                                                | 加行內允許（測試假資料）              | N/A                |
| 127 | useTelegram.test.js:204        | `themeParams: { bg_color: "#ffffff" },`                                     | 加行內允許（測試假資料）              | N/A                |
| 128 | useTelegram.test.js:310        | `expect(tg.setHeaderColor).toHaveBeenCalledWith("#ffffff");`                | 加行內允許（測試假資料）              | N/A                |
| 129 | useTelegram.test.js:311        | `expect(tg.setBackgroundColor).toHaveBeenCalledWith("#ffffff");`            | 加行內允許（測試假資料）              | N/A                |
| 130 | useTelegram.test.js:326        | `expect(tg.setHeaderColor).toHaveBeenCalledWith("#1a1a1a");`                | 加行內允許（測試假資料）              | N/A                |
| 131 | useTelegram.test.js:327        | `expect(tg.setBackgroundColor).toHaveBeenCalledWith("#1a1a1a");`            | 加行內允許（測試假資料）              | N/A                |
| 132 | useTelegram.test.js:335        | `expect(() => value.setHeaderColor("#2481cc")).not.toThrow();`              | 加行內允許（測試假資料）              | N/A                |
| 133 | main.js:41                     | `color:var(--tg-theme-hint-color, #888);`                                   | 待討論（var fallback）                | N/A                |
| 134 | main.js:42                     | `background:var(--tg-theme-bg-color, #fff);`                                | 待討論（var fallback）                | N/A                |
| 135 | exportUtility.js:153           | `backgroundColor = "var(--tg-theme-text-color, #fff)",`                     | 待討論（var fallback）                | N/A                |
| 136 | AccountView.vue:573            | `border-bottom: 1px solid rgba(0, 0, 0, 0.06);`                             | 改用既有令牌                          | 待確認             |
| 137 | AccountView.vue:594            | `box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);`                                | 需新增令牌                            | ⚠️ 需新增覆寫      |
| 138 | AccountView.vue:633            | `border-bottom: 1px solid rgba(0, 0, 0, 0.04);`                             | 改用既有令牌                          | 待確認             |
| 139 | AccountView.vue:659            | `background: rgba(52, 199, 89, 0.08);`                                      | 需新增令牌                            | ⚠️ 需新增覆寫      |
| 140 | AccountView.vue:660            | `border-color: rgba(52, 199, 89, 0.2);`                                     | 改用既有令牌                          | 待確認             |
| 141 | AccountView.vue:663            | `background: rgba(255, 59, 48, 0.08);`                                      | 需新增令牌                            | ⚠️ 需新增覆寫      |
| 142 | AccountView.vue:664            | `border-color: rgba(255, 59, 48, 0.2);`                                     | 改用既有令牌                          | 待確認             |
| 143 | AccountView.vue:667            | `background: rgba(255, 204, 0, 0.08);`                                      | 需新增令牌                            | ⚠️ 需新增覆寫      |
| 144 | AccountView.vue:668            | `border-color: rgba(255, 204, 0, 0.2);`                                     | 改用既有令牌                          | 待確認             |
| 145 | AccountView.vue:748            | `background: rgba(0, 0, 0, 0.02);`                                          | 需新增令牌                            | ⚠️ 需新增覆寫      |
| 146 | AccountView.vue:756            | `background: rgba(0, 0, 0, 0.02);`                                          | 需新增令牌                            | ⚠️ 需新增覆寫      |
| 147 | DashboardView.vue:502          | `box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);`                               | 需新增令牌                            | ⚠️ 需新增覆寫      |
| 148 | MacroBattleView.vue:465        | `rgba(255, 255, 255, 0.35) 50%,`                                            | 需新增令牌                            | ⚠️ 需新增覆寫      |
| 149 | MarketRadarView.vue:642        | `rgba(255, 255, 255, 0.35) 50%,`                                            | 需新增令牌                            | ⚠️ 需新增覆寫      |
| 150 | MarketRadarView.vue:677        | `background: rgba(244, 67, 54, 0.12);`                                      | 需新增令牌                            | ⚠️ 需新增覆寫      |
| 151 | MarketRadarView.vue:678        | `border: 1px solid rgba(244, 67, 54, 0.35);`                                | 改用既有令牌                          | 待確認             |
| 152 | MarketRadarView.vue:693        | `box-shadow: 0 0 0 0 rgba(198, 40, 40, 0.2);`                               | 需新增令牌                            | ⚠️ 需新增覆寫      |
| 153 | MarketRadarView.vue:696        | `box-shadow: 0 0 0 4px rgba(198, 40, 40, 0.1);`                             | 需新增令牌                            | ⚠️ 需新增覆寫      |
| 154 | TechnicalView.vue:606          | `background: rgba(232, 72, 85, 0.08);`                                      | 需新增令牌                            | ⚠️ 需新增覆寫      |
| 155 | TechnicalView.vue:609          | `background: rgba(0, 0, 0, 0.03);`                                          | 需新增令牌                            | ⚠️ 需新增覆寫      |
| 156 | TheoryView.vue:331             | `background: rgba(158, 158, 158, 0.08);`                                    | 需新增令牌                            | ⚠️ 需新增覆寫      |
