# Jeopardy z twistem

Imprezowy teleturniej do odpalenia w przeglądarce i wystawienia na GitHub Pages.
Prowadzący otwiera studio na dużym ekranie, gracze dołączają telefonami do lobby
(kod pokoju lub QR), a wszystkie punkty, klucze odpowiedzi i timery widzi tylko admin.

Cała gra działa bez backendu: plansza i stan gry żyją w przeglądarce prowadzącego,
a telefony łączą się z nim peer-to-peer (WebRTC/PeerJS) albo — gdy gracze są w tej
samej przeglądarce — przez `BroadcastChannel`.

## Uruchomienie lokalne

```bash
npm install
npm run dev          # http://localhost:43717
```

Inne polecenia:

```bash
npm run build        # produkcyjny build do dist/
npm run preview      # podgląd builda
npm run lint         # oxlint
npm test             # testy silnika gry (vitest)
npx tsc -b           # kontrola typów
```

Testy w `src/lib/engine.test.ts` sprawdzają reguły punktacji: nagrody i kary,
turę w Kole fortuny, pulę w Kole fortuny, rozliczenie wyliczanki, licytację
i obstawianie w finale.

## Publikacja na GitHub Pages

1. Wypchnij kod na GitHuba (workflow reaguje na gałąź `main` i `master`):

   ```bash
   git remote add gh https://github.com/<użytkownik>/<repo>.git
   git push gh HEAD:master
   ```

2. W `Settings → Pages` ustaw **Source: GitHub Actions**.
3. Workflow `.github/workflows/deploy.yml` sprawdzi lint i testy, zbuduje projekt
   i wystawi go pod `https://<użytkownik>.github.io/<repo>/`.

Build używa `base: './'` i routingu po hashu (`#/admin`, `#/play`, `#/editor`),
więc działa z dowolnej podścieżki i nie wymaga przekierowań serwera.

## Jak się gra

### Role

- **Prowadzący (`#/admin`)** — kod pokoju + QR, lista graczy, plansza, klucze odpowiedzi,
  listy odpowiedzi do odznaczania, timery, korekty punktów i przycisk „Tryb ekranu”,
  który chowa panel sterowania, gdy ekran jest widoczny dla widowni.
- **Gracz (`#/play`)** — nick, ikona, przycisk zgłoszenia, ABCD, pole odpowiedzi,
  licytacja, klawiatura liter w Kole fortuny i obstawianie w finale. Widzi planszę,
  ale to prowadzący klika, które pytanie się otwiera — telefon gracza tylko podgląda.
- **Gracz lokalny (hot-seat)** — prowadzący dodaje go w lobby i klika za niego
  (przydatne, gdy ktoś nie ma telefonu albo gdy grasz z jednego laptopa).

`#/admin` i `#/editor` są dodatkowo chronione PIN-em (domyślnie `1234`, zmienisz go w
edytorze w zakładce „Zasady”) — nawet jeśli gracz trafi na ten sam link co host (np.
wchodząc na sam adres strony bez `#/play`), zobaczy tylko ekran proszący o PIN, a nie
pytania czy panel prowadzącego. To nie jest prawdziwe zabezpieczenie (to statyczna
strona bez backendu, więc ktoś naprawdę uparty i tak zajrzy w kod źródłowy) — ma tylko
uchronić przed przypadkowym trafieniem gracza na klucze odpowiedzi. Link do dołączenia,
który wysyłasz graczom, to zawsze `#/play?code=…` (widoczny w panelu prowadzącego jako
kod i QR) — sam z siebie nigdzie nie prowadzi do admina ani edytora.

### Plansza

8 kategorii × 6 pytań, wartości 100–600. Kategoria **Koło fortuny** ma mnożnik ×2, czyli
200–1200. Kategoria **Sanah czy Adolf Hitler** ma mnożnik ×0.5, czyli 50–300. Kategorie
**Wyliż chunka** i **Licytacje** mają stałą wartość każdego pytania, niezależną od
mnożnika — odpowiednio 600 i 300.

Błędna odpowiedź: **−wartość pytania**. Bez żadnej pauzy — gracz od razu wraca do gry.

### Typy pytań

| Typ | Jak działa |
| --- | --- |
| Zwykłe (ABCD / otwarte) | Admin otwiera pytanie z planszy — zgłoszenia są od razu aktywne, więc gracze mogą się zgłaszać, gdy tylko treść pojawi się na ekranie. Pierwszy zgłoszony dostaje głos, odpowiedź ocenia admin. |
| Audio | Pytanie z nagraniem albo z lektorem (synteza mowy przeglądarki) — dźwięk leci z ekranu hosta i z telefonu gracza, gra się raz (bez zapętlania). |
| Koło fortuny | Hasło z zasłoniętymi literami. Koło (jeden BANKRUT, wartości 10–150) kręci się na telefonie gracza i na ekranie hosta jednocześnie. Kolejka do kręcenia: najpierw gracz, który wybrał kategorię, potem reszta od najwyższego wyniku do najniższego — tylko ten gracz może kręcić, podawać litery i zgłosić rozwiązanie hasła, inni czekają na swoją turę (admin może pominąć czyjąś kolej przyciskiem „Kolejka dalej”). Trafienie spółgłoski dodaje `wartość koła × liczba trafień` do puli (bonus). Samogłoskę kupuje się za własne punkty gracza (nie z puli). Trafione hasło = wartość pytania + pula. |
| Wyliż chunka | Gracze wymieniają odpowiedzi na przemian, admin odznacza je na liście i pilnuje żyć (jedna pomyłka bez konsekwencji). Wygrane nie zależą od wylosowanego pola na planszy — 1. miejsce zawsze dostaje stałą kwotę (domyślnie 600), każde kolejne miejsce o 200 mniej (400, 200, 0, −200…), bez dolnego limitu. |
| Licytacje | Gracze podbijają, ile odpowiedzi wymienią. Admin zatrzymuje licytację, odlicza czas, odznacza trafienia i uznaje albo odrzuca całość. |

### Finał

Po wyczerpaniu planszy startuje runda finałowa: 3 pytania otwarte. Dla każdego
pytania gracze najpierw słyszą kategorię i obstawiają punkty (max = ich stan konta,
nie mniej niż 1000), potem piszą odpowiedzi na telefonach, a admin odkrywa je
**publicznie, jedna po drugiej** i uznaje lub odrzuca. Na koniec pokazuje się podium
ze zwycięzcą.

## Edytor pytań (`#/editor`)

- Kategorie: dodawanie, usuwanie, nazwa, mnożnik ×1/×2.
- Pytania: typ, treść, podpowiedzi ABCD (z oznaczeniem poprawnej) albo pytanie otwarte,
  klucz odpowiedzi, notatka dla prowadzącego, tekst dla lektora.
- Multimedia w pytaniu, w odpowiedzi i w każdej opcji ABCD: zdjęcie, audio lub wideo —
  z linku (`https://…`) albo wgrane z dysku.
- Listy odpowiedzi dla wyliczanki i licytacji (jedna pozycja na linię), liczba żyć,
  długość timera.
- Pytania finałowe i globalne zasady (wartości wierszy, koszt samogłoski, wypłaty
  w wyliczance, timery, PIN chroniący admina i edytor).
- Pakiet zapisuje się automatycznie w przeglądarce (IndexedDB) i można go
  eksportować/importować jako JSON.

Materiały z linków `https://…` widzą też gracze na telefonach. Pliki wgrane z dysku
trafiają tylko na ekran prowadzącego (nie zapychają połączenia peer-to-peer).

## Połączenia i sieć

- Domyślnie gracze łączą się przez publiczny broker PeerJS (WebRTC). W panelu admina
  widać status: „gracze mogą dołączać z telefonów”.
- Jeśli sieć blokuje WebRTC, gra nadal działa w obrębie jednej przeglądarki
  (dodatkowe karty/okna z linkiem dla gracza) oraz w trybie hot-seat.
- Stan gry trzyma host; odświeżenie karty prowadzącego zaczyna nową rozgrywkę,
  a gracze wracają do lobby po ponownym wejściu na link.

## Struktura projektu

```
src/
  lib/          model danych (types.ts), silnik gry (engine.ts), sieć (net.ts),
                zapis pakietów (storage.ts), pakiet startowy (defaultPack.ts)
  hooks/        useHostGame (host + broadcast), usePlayerGame (klient), useTicker
  components/   ui/ (przyciski, panele), game/ (plansza, koło, panel admina, finał)
  screens/      Home, Admin, Play, Editor
```

Pakiet startowy zawiera przykładowe pytania do wszystkich ośmiu kategorii oraz
trzy pytania finałowe — przed imprezą warto je podmienić we własnym edytorze.
