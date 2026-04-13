# SkyPort Backend Branch Guide (RAD + SDD Base)

Bu dokuman, backend gelistirmesini feature branch yapisinda guvenli ve izlenebilir sekilde ilerletmek icin hazirlanmistir.
Kapsam ve oncelikler RAD ve SDD dokumanlarindaki mimari, modul ve teslim hedeflerine gore belirlenmistir.

## 1. Guncel Branch Stratejisi

Ana akis:

1. `main` (stabil teslim branch'i)
2. `backend-init` (sadece baslangic kurulumlari icin acilmis feature branch)
3. `feature/*` (tek sorumluluklu gelistirme branch'leri)

Onemli not:

1. `backend-init` bir entegrasyon branch'i degildir.
2. `backend-init` tamamlandiktan sonra PR ile `main`e merge edilir ve kapanir.
3. Sonraki tum backend feature branch'leri `main` baz alinarak acilir.

Kurallar:

1. Her feature branch sadece tek is paketi kapsar.
2. Tum PR'lar `main`e acilir.
3. Sema degisikligi iceren PR'larda migration dosyasi zorunludur.
4. API degisikligi iceren PR'larda endpoint contract guncellemesi zorunludur.

## 2. Branch Isimlendirme

`backend-init` sonrasi onerilen branch listesi:

1. `feature/be-02-auth-rbac`
2. `feature/be-03-db-postgis-core`
3. `feature/be-04-geodata-ingestion`
4. `feature/be-05-analysis-mcdm`
5. `feature/be-06-routing-safety-weather`
6. `feature/be-07-vertiport-favorites`
7. `feature/be-08-reports-export`
8. `feature/be-09-observability-resilience`
9. `feature/be-10-hardening-tests`

Not:

1. `backend-init` fiilen `be-01-foundation` kapsamidir.
2. Ayrica `feature/be-01-foundation` acmana gerek yok; bu isi `backend-init` yapiyor.

## 3. Global Backend Backlog (RAD/SDD)

1. User Management (Auth, Register, Profile, RBAC)
2. Geospatial Data Management (OSM extraction, H3, spatial queries)
3. Analysis Management (AHP/TOPSIS, heatmap, compare, async status)
4. Routing Module (route simulation, safety check, weather impact)
5. Vertiport Management (active network, filtering, details, favorites)
6. Report Management (save analysis, export PDF/CSV/GeoJSON, history)
7. Cross-cutting (security, logging, monitoring, graceful degradation)

## 4. Branch Bazli Gelistirme Plani

### `backend-init` (aktif)

Amac:

1. Backend temel iskeletini kurmak.
2. Tum sonraki feature branch'ler icin ortak kalite standardini belirlemek.

Icerik:

1. Framework setup (FastAPI onerilir; SDD Python backend ile uyumlu)
2. Proje klasorleme (`app/api`, `app/services`, `app/repos`, `app/models`, `app/core`)
3. Env/config yonetimi
4. Health endpoints (`/health/live`, `/health/ready`)
5. Uygulama startup/shutdown lifecycle
6. Temel error response formati

PR Kabul Kriteri:

1. Servis ayaga kalkiyor.
2. Health endpoint'leri 200 donuyor.
3. Lint/format check temiz.

---

### `feature/be-02-auth-rbac`

Amac:

1. RAD/SDD User Management servislerini baslatmak.
2. B2B/B2C rol tabanli erisim modelini devreye almak.

Icerik:

1. `POST /api/auth/register`
2. `POST /api/auth/login`
3. `GET /api/users/me`
4. `PATCH /api/users/me`
5. JWT access token uretimi/dogrulama
6. Role enum: `expert`, `passenger`
7. Route guard/dependency ile RBAC kontrolu

PR Kabul Kriteri:

1. Gecerli kimlik bilgisiyle token uretiliyor.
2. Yetkisiz istekler 401/403 donuyor.
3. Sifre hash + dogrulama guvenli.

---

### `feature/be-03-db-postgis-core`

Amac:

1. Persistent Data Management altyapisini RAD/SDD ile hizalamak.
2. PostGIS tabanli cekirdek veri modelini olusturmak.

Icerik:

1. DB baglanti katmani + migration altyapisi
2. Tablolar: `users`, `vertiports`, `favorites`, `analyses`, `analysis_results`, `routes`, `reports`
3. Spatial kolonlar (geometry/geography)
4. GiST index'ler
5. Seed icin minimum test verisi

PR Kabul Kriteri:

1. Sifirdan DB kurulumunda migration tek komutla tamamlaniyor.
2. Spatial index'ler aktif.
3. Basit CRUD smoke test geciyor.

---

### `feature/be-04-geodata-ingestion`

Amac:

1. Geospatial Data Management giris katmanini kurmak.
2. OSM verisini sisteme kontrollu almak.

Icerik:

1. OSM extraction servisleri (`extractOSMData(boundingBox)`)
2. Katmanlar: bina, yol, arazi kullanimi, NFZ
3. Data cleaning + CRS donusumu
4. H3 grid uretimi (`generateH3Grid(regionId, resolution)`)
5. Ingestion job logs + hata mesajlari
6. Kismi veri senaryosunda `partial success` response standardi

PR Kabul Kriteri:

1. Girilen bbox icin veri cekip DB'ye yaziyor.
2. Eksik katmanda sistem crash olmuyor.
3. Job sonucu state + uyari mesaji donuyor.

---

### `feature/be-05-analysis-mcdm`

Amac:

1. Analysis Management modulunu calistirmak.
2. AHP/TOPSIS tabanli suitability skor uretmek.

Icerik:

1. `POST /api/analysis` (region + criteriaWeights)
2. `GET /api/analysis/{id}/status`
3. `GET /api/analysis/{id}/result`
4. `GET /api/analysis/{id}/heatmap` (GeoJSON)
5. `POST /api/analysis/compare`
6. Criteria weight validation
7. Async execution

PR Kabul Kriteri:

1. Gecerli weights ile analiz tamamlaniyor.
2. Hatali weights 4xx mesaji veriyor.
3. Heatmap response formati frontend tuketimine uygun.

---

### `feature/be-06-routing-safety-weather`

Amac:

1. Routing Module fonksiyonlarini aktif etmek.
2. Guvenlik ve hava etkisi kontrolunu entegre etmek.

Icerik:

1. `POST /api/route` (fromId, toId, constraints)
2. `POST /api/route/{id}/safety-check`
3. `GET /api/route/{id}/simulation`
4. Weather provider client + timeout/retry
5. Weather unavailable durumunda graceful degradation
6. Obstacle/NFZ kesisim kontrolleri (PostGIS)

PR Kabul Kriteri:

1. Route endpoint beklenen alanlari donduruyor (`coordinates`, `distance_km`, `duration_min`, `price_tl`).
2. Guvenlik check sonucu anlasilir detay iceriyor.
3. Weather API yoksa sistem kontrollu fallback yapiyor.

---

### `feature/be-07-vertiport-favorites`

Amac:

1. Passenger odakli Vertiport Management servislerini tamamlamak.
2. LocalStorage yerine kalici backend tabanli favoris sistemini acmak.

Icerik:

1. `GET /api/vertiports`
2. `GET /api/vertiports/{id}`
3. `POST /api/vertiports/filter`
4. `GET /api/favorites`
5. `POST /api/favorites`
6. `DELETE /api/favorites/{vertiportId}`

PR Kabul Kriteri:

1. Filtre sonucu tutarli donuyor.
2. Kullanicilar birbirinin favorilerini goremiyor.
3. Duplicate favorite engelleniyor.

---

### `feature/be-08-reports-export`

Amac:

1. Report Management gereksinimlerini karsilamak.
2. Analiz saklama ve disa aktarma akislarini bitirmek.

Icerik:

1. `POST /api/reports/save-analysis`
2. `POST /api/reports/export` (PDF/CSV/GeoJSON)
3. `GET /api/reports/history`
4. Export job/stream yonetimi
5. Dosya metadata ve erisim kontrolu

PR Kabul Kriteri:

1. Expert kullanicisi export alabiliyor.
2. History yalnizca ilgili kullanici verisini listeliyor.
3. Gecersiz format istegi kontrollu hata donuyor.

---

### `feature/be-09-observability-resilience`

Amac:

1. Cross-cutting concerns tarafini uretim seviyesine yaklastirmak.
2. SDD boundary conditions (startup/shutdown/error) hedeflerini uygulamak.

Icerik:

1. Structured logging (request-id, user-id, module-id)
2. Performans metrikleri (latency, error rate, job duration)
3. Merkezi exception handler
4. Timeout/retry policy (OSM, weather, dis servisler)
5. Graceful shutdown
6. Rate limiting + security headers

PR Kabul Kriteri:

1. Kritik olaylar log'da izleniyor.
2. Shutdown sirasinda acik isler guvenli kapaniyor/isaretleniyor.
3. Dis API timeout durumlari kullaniciyi kilitlemiyor.

---

### `feature/be-10-hardening-tests`

Amac:

1. Backend'i final entegrasyon oncesi stabilize etmek.
2. Test kapsamasini ve sozlesme dogrulamasini saglamak.

Icerik:

1. Unit tests (auth, validation, scoring helpers)
2. Integration tests (db + api)
3. Contract tests (frontend'in bekledigi payload yapilari)
4. Load/smoke test (analiz ve route endpointleri)
5. Security checklist (auth bypass, idor, input abuse)

PR Kabul Kriteri:

1. Test pipeline yesil.
2. Kritik endpointlerde negatif testler mevcut.
3. Bilinen blocker bug kalmamis.

## 5. Onerilen Merge Sirasi (`main`e)

1. `backend-init`
2. `feature/be-03-db-postgis-core`
3. `feature/be-02-auth-rbac`
4. `feature/be-07-vertiport-favorites`
5. `feature/be-04-geodata-ingestion`
6. `feature/be-05-analysis-mcdm`
7. `feature/be-06-routing-safety-weather`
8. `feature/be-08-reports-export`
9. `feature/be-09-observability-resilience`
10. `feature/be-10-hardening-tests`

Not:

1. `be-02` ve `be-03` paralel baslatilabilir, ancak `be-02` merge'i icin user tablolari hazir olmali.
2. Frontend hizli entegrasyon icin `be-07` erken merge edilebilir.

## 6. Her Feature PR Icin Checklist

1. Amac (RAD/SDD referansi ile)
2. Kapsam disi maddeler
3. Endpoint degisiklikleri
4. DB migration var mi?
5. Backward compatibility etkisi
6. Test kaniti (unit/integration)
7. Hata senaryolari
8. Guvenlik etkisi (auth/rbac/data exposure)
9. Gozlemlenebilirlik etkisi (log/metric)
10. Rollback plani

## 7. Done Definition (Backend Genel)

1. Kod + test + migration + dokumantasyon birlikte gelmeli.
2. API response yapisi stabil olmali.
3. Hata mesajlari standart formatta olmali.
4. RBAC ve input validation eksiksiz olmali.
5. `main`e merge oncesi gerekli entegrasyon testleri kirilmamali.

## 8. RAD/SDD Izlenebilirlik Matrisi (Kisa)

1. User Management -> `be-02`
2. Data Access & Persistent Data -> `be-03`
3. Geospatial Data Management -> `be-04`
4. Analysis Management (AHP/TOPSIS + Heatmap) -> `be-05`
5. Routing + Safety + Weather -> `be-06`
6. Vertiport + Favorites (B2C) -> `be-07`
7. Report Management -> `be-08`
8. Security/Logging/Boundary Conditions -> `be-09`
9. Verification & Integration -> `be-10`

Bu sirayla gidersen `backend-init` sonrasinda tum backend gelistirmesini dusuk riskle, izole ve takip edilebilir sekilde yurutebilirsin.