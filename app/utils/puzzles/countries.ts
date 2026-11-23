/**
 * Country data bundled with the add-on (no network): iso2 | name | lat | lon | continent | population (millions, ~2024)
 * | capital | main language. Continents: AF AS EU NA SA OC (Russia and Turkey are listed under EU / AS).
 */
const TABLE = `
DZ|Algeria|28.0|2.6|AF|46.8|Algiers|Arabic
AO|Angola|-12.3|17.5|AF|37.9|Luanda|Portuguese
BJ|Benin|9.6|2.3|AF|14.5|Porto-Novo|French
BW|Botswana|-22.3|24.7|AF|2.52|Gaborone|English
BF|Burkina Faso|12.3|-1.7|AF|23.5|Ouagadougou|French
BI|Burundi|-3.4|29.9|AF|13.2|Gitega|Kirundi
CV|Cabo Verde|16.0|-24.0|AF|0.525|Praia|Portuguese
CM|Cameroon|5.7|12.7|AF|28.6|Yaoundé|French
CF|Central African Republic|6.6|20.9|AF|5.33|Bangui|French
TD|Chad|15.4|18.7|AF|20.3|N'Djamena|French
KM|Comoros|-11.9|43.9|AF|0.852|Moroni|Comorian
CG|Republic of the Congo|-0.7|15.2|AF|6.27|Brazzaville|French
CD|DR Congo|-2.9|23.7|AF|109|Kinshasa|French
CI|Ivory Coast|7.6|-5.5|AF|31.9|Yamoussoukro|French
DJ|Djibouti|11.8|42.6|AF|1.15|Djibouti|Arabic
EG|Egypt|26.8|30.0|AF|116|Cairo|Arabic
GQ|Equatorial Guinea|1.6|10.5|AF|1.74|Malabo|Spanish
ER|Eritrea|15.2|39.8|AF|3.75|Asmara|Tigrinya
SZ|Eswatini|-26.5|31.5|AF|1.21|Mbabane|English
ET|Ethiopia|9.1|40.5|AF|130|Addis Ababa|Amharic
GA|Gabon|-0.8|11.6|AF|2.46|Libreville|French
GM|Gambia|13.4|-15.3|AF|2.77|Banjul|English
GH|Ghana|7.9|-1.0|AF|34.4|Accra|English
GN|Guinea|9.9|-9.7|AF|14.8|Conakry|French
GW|Guinea-Bissau|12.0|-15.2|AF|2.2|Bissau|Portuguese
KE|Kenya|0.0|37.9|AF|56.4|Nairobi|Swahili
LS|Lesotho|-29.6|28.2|AF|2.33|Maseru|Sesotho
LR|Liberia|6.4|-9.4|AF|5.61|Monrovia|English
LY|Libya|26.3|17.2|AF|7.4|Tripoli|Arabic
MG|Madagascar|-18.8|46.9|AF|31.9|Antananarivo|Malagasy
MW|Malawi|-13.3|34.3|AF|21.7|Lilongwe|English
ML|Mali|17.6|-4.0|AF|24.5|Bamako|French
MR|Mauritania|21.0|-10.9|AF|5.2|Nouakchott|Arabic
MU|Mauritius|-20.3|57.6|AF|1.26|Port Louis|English
MA|Morocco|31.8|-7.1|AF|37.8|Rabat|Arabic
MZ|Mozambique|-18.7|35.5|AF|34.6|Maputo|Portuguese
NA|Namibia|-22.6|17.1|AF|3.02|Windhoek|English
NE|Niger|17.6|8.1|AF|27.2|Niamey|French
NG|Nigeria|9.1|8.7|AF|232|Abuja|English
RW|Rwanda|-1.9|29.9|AF|14.3|Kigali|Kinyarwanda
ST|São Tomé and Príncipe|0.2|6.6|AF|0.234|São Tomé|Portuguese
SN|Senegal|14.5|-14.5|AF|18.4|Dakar|French
SC|Seychelles|-4.7|55.5|AF|0.13|Victoria|English
SL|Sierra Leone|8.5|-11.8|AF|8.6|Freetown|English
SO|Somalia|5.2|46.2|AF|19|Mogadishu|Somali
ZA|South Africa|-30.6|22.9|AF|64|Pretoria|English
SS|South Sudan|6.9|31.3|AF|11.9|Juba|English
SD|Sudan|12.9|30.2|AF|50.4|Khartoum|Arabic
TZ|Tanzania|-6.4|34.9|AF|68.6|Dodoma|Swahili
TG|Togo|8.6|0.8|AF|9.5|Lomé|French
TN|Tunisia|33.9|9.5|AF|12.3|Tunis|Arabic
UG|Uganda|1.4|32.3|AF|50|Kampala|English
ZM|Zambia|-13.1|27.8|AF|21.3|Lusaka|English
ZW|Zimbabwe|-19.0|29.2|AF|16.6|Harare|English
AF|Afghanistan|33.9|67.7|AS|41.5|Kabul|Pashto
AM|Armenia|40.1|45.0|AS|2.99|Yerevan|Armenian
AZ|Azerbaijan|40.1|47.6|AS|10.3|Baku|Azerbaijani
BH|Bahrain|26.0|50.6|AS|1.57|Manama|Arabic
BD|Bangladesh|23.7|90.4|AS|173|Dhaka|Bengali
BT|Bhutan|27.5|90.4|AS|0.787|Thimphu|Dzongkha
BN|Brunei|4.5|114.7|AS|0.452|Bandar Seri Begawan|Malay
KH|Cambodia|12.6|104.9|AS|17.1|Phnom Penh|Khmer
CN|China|35.9|104.2|AS|1410|Beijing|Mandarin
GE|Georgia|42.3|43.4|AS|3.7|Tbilisi|Georgian
IN|India|20.6|78.9|AS|1450|New Delhi|Hindi
ID|Indonesia|-0.8|113.9|AS|283|Jakarta|Indonesian
IR|Iran|32.4|53.7|AS|91.6|Tehran|Persian
IQ|Iraq|33.2|43.7|AS|46|Baghdad|Arabic
IL|Israel|31.0|34.9|AS|9.8|Jerusalem|Hebrew
JP|Japan|36.2|138.3|AS|124|Tokyo|Japanese
JO|Jordan|30.6|36.2|AS|11.6|Amman|Arabic
KZ|Kazakhstan|48.0|66.9|AS|20.4|Astana|Kazakh
KW|Kuwait|29.3|47.5|AS|4.9|Kuwait City|Arabic
KG|Kyrgyzstan|41.2|74.8|AS|7.2|Bishkek|Kyrgyz
LA|Laos|19.9|102.5|AS|7.7|Vientiane|Lao
LB|Lebanon|33.9|35.9|AS|5.8|Beirut|Arabic
MY|Malaysia|4.2|102.0|AS|34.7|Kuala Lumpur|Malay
MV|Maldives|3.2|73.2|AS|0.521|Malé|Dhivehi
MN|Mongolia|46.9|103.8|AS|3.45|Ulaanbaatar|Mongolian
MM|Myanmar|21.9|95.9|AS|54.5|Naypyidaw|Burmese
NP|Nepal|28.4|84.1|AS|30|Kathmandu|Nepali
KP|North Korea|40.3|127.5|AS|26.6|Pyongyang|Korean
OM|Oman|21.5|55.9|AS|5.3|Muscat|Arabic
PK|Pakistan|30.4|69.3|AS|245|Islamabad|Urdu
PH|Philippines|12.9|121.8|AS|115|Manila|Filipino
QA|Qatar|25.4|51.2|AS|2.86|Doha|Arabic
SA|Saudi Arabia|23.9|45.1|AS|35.3|Riyadh|Arabic
SG|Singapore|1.35|103.8|AS|6.04|Singapore|English
KR|South Korea|35.9|127.8|AS|51.7|Seoul|Korean
LK|Sri Lanka|7.9|80.8|AS|22.9|Colombo|Sinhala
SY|Syria|34.8|39.0|AS|24.7|Damascus|Arabic
TW|Taiwan|23.7|121.0|AS|23.4|Taipei|Mandarin
TJ|Tajikistan|38.9|71.3|AS|10.6|Dushanbe|Tajik
TH|Thailand|15.9|101.0|AS|71.7|Bangkok|Thai
TL|Timor-Leste|-8.9|125.7|AS|1.38|Dili|Tetum
TR|Turkey|39.0|35.2|AS|85.7|Ankara|Turkish
TM|Turkmenistan|39.0|59.6|AS|7.5|Ashgabat|Turkmen
AE|United Arab Emirates|23.4|53.8|AS|11|Abu Dhabi|Arabic
UZ|Uzbekistan|41.4|64.6|AS|36.4|Tashkent|Uzbek
VN|Vietnam|14.1|108.3|AS|101|Hanoi|Vietnamese
YE|Yemen|15.6|48.5|AS|35|Sanaa|Arabic
AL|Albania|41.2|20.2|EU|2.77|Tirana|Albanian
AD|Andorra|42.5|1.5|EU|0.0824|Andorra la Vella|Catalan
AT|Austria|47.5|14.6|EU|9.16|Vienna|German
BY|Belarus|53.7|27.9|EU|9.11|Minsk|Belarusian
BE|Belgium|50.5|4.5|EU|11.8|Brussels|Dutch
BA|Bosnia and Herzegovina|43.9|17.7|EU|3.19|Sarajevo|Bosnian
BG|Bulgaria|42.7|25.5|EU|6.45|Sofia|Bulgarian
HR|Croatia|45.1|15.2|EU|3.86|Zagreb|Croatian
CY|Cyprus|35.1|33.4|EU|1.35|Nicosia|Greek
CZ|Czechia|49.8|15.5|EU|10.9|Prague|Czech
DK|Denmark|56.3|9.5|EU|5.96|Copenhagen|Danish
EE|Estonia|58.6|25.0|EU|1.37|Tallinn|Estonian
FI|Finland|61.9|25.7|EU|5.6|Helsinki|Finnish
FR|France|46.2|2.2|EU|68.4|Paris|French
DE|Germany|51.2|10.4|EU|83.6|Berlin|German
GR|Greece|39.1|21.8|EU|10.4|Athens|Greek
HU|Hungary|47.2|19.5|EU|9.58|Budapest|Hungarian
IS|Iceland|65.0|-19.0|EU|0.389|Reykjavík|Icelandic
IE|Ireland|53.4|-8.2|EU|5.38|Dublin|English
IT|Italy|41.9|12.6|EU|58.9|Rome|Italian
LV|Latvia|56.9|24.6|EU|1.87|Riga|Latvian
LI|Liechtenstein|47.2|9.6|EU|0.0397|Vaduz|German
LT|Lithuania|55.2|23.9|EU|2.89|Vilnius|Lithuanian
LU|Luxembourg|49.8|6.1|EU|0.67|Luxembourg|Luxembourgish
MT|Malta|35.9|14.4|EU|0.564|Valletta|Maltese
MD|Moldova|47.4|28.4|EU|2.6|Chișinău|Romanian
MC|Monaco|43.7|7.4|EU|0.0393|Monaco|French
ME|Montenegro|42.7|19.4|EU|0.62|Podgorica|Montenegrin
NL|Netherlands|52.1|5.3|EU|17.9|Amsterdam|Dutch
MK|North Macedonia|41.6|21.7|EU|1.81|Skopje|Macedonian
NO|Norway|60.5|8.5|EU|5.55|Oslo|Norwegian
PL|Poland|51.9|19.1|EU|36.6|Warsaw|Polish
PT|Portugal|39.4|-8.2|EU|10.6|Lisbon|Portuguese
RO|Romania|45.9|25.0|EU|19.1|Bucharest|Romanian
RU|Russia|61.5|105.3|EU|144|Moscow|Russian
SM|San Marino|43.9|12.5|EU|0.034|San Marino|Italian
RS|Serbia|44.0|21.0|EU|6.62|Belgrade|Serbian
SK|Slovakia|48.7|19.7|EU|5.42|Bratislava|Slovak
SI|Slovenia|46.2|15.0|EU|2.12|Ljubljana|Slovene
ES|Spain|40.5|-3.7|EU|48.6|Madrid|Spanish
SE|Sweden|60.1|18.6|EU|10.6|Stockholm|Swedish
CH|Switzerland|46.8|8.2|EU|9.05|Bern|German
UA|Ukraine|48.4|31.2|EU|38|Kyiv|Ukrainian
GB|United Kingdom|55.4|-3.4|EU|69.3|London|English
VA|Vatican City|41.9|12.45|EU|0.0008|Vatican City|Italian
AG|Antigua and Barbuda|17.1|-61.8|NA|0.094|Saint John's|English
BS|Bahamas|25.0|-77.4|NA|0.399|Nassau|English
BB|Barbados|13.2|-59.5|NA|0.282|Bridgetown|English
BZ|Belize|17.2|-88.5|NA|0.411|Belmopan|English
CA|Canada|56.1|-106.3|NA|41.3|Ottawa|English
CR|Costa Rica|9.7|-83.8|NA|5.18|San José|Spanish
CU|Cuba|21.5|-77.8|NA|11|Havana|Spanish
DM|Dominica|15.4|-61.4|NA|0.0731|Roseau|English
DO|Dominican Republic|18.7|-70.2|NA|11.4|Santo Domingo|Spanish
SV|El Salvador|13.8|-88.9|NA|6.37|San Salvador|Spanish
GD|Grenada|12.1|-61.7|NA|0.126|Saint George's|English
GT|Guatemala|15.8|-90.2|NA|18.4|Guatemala City|Spanish
HT|Haiti|19.0|-72.3|NA|11.9|Port-au-Prince|Haitian Creole
HN|Honduras|15.2|-86.2|NA|10.7|Tegucigalpa|Spanish
JM|Jamaica|18.1|-77.3|NA|2.84|Kingston|English
MX|Mexico|23.6|-102.6|NA|131|Mexico City|Spanish
NI|Nicaragua|12.9|-85.2|NA|6.95|Managua|Spanish
PA|Panama|8.5|-80.8|NA|4.51|Panama City|Spanish
KN|Saint Kitts and Nevis|17.3|-62.7|NA|0.0475|Basseterre|English
LC|Saint Lucia|13.9|-61.0|NA|0.18|Castries|English
VC|Saint Vincent and the Grenadines|13.0|-61.3|NA|0.103|Kingstown|English
TT|Trinidad and Tobago|10.7|-61.2|NA|1.53|Port of Spain|English
US|United States|37.1|-95.7|NA|340|Washington, D.C.|English
AR|Argentina|-38.4|-63.6|SA|46|Buenos Aires|Spanish
BO|Bolivia|-16.3|-63.6|SA|12.4|Sucre|Spanish
BR|Brazil|-14.2|-51.9|SA|212|Brasília|Portuguese
CL|Chile|-35.7|-71.5|SA|19.8|Santiago|Spanish
CO|Colombia|4.6|-74.3|SA|52.7|Bogotá|Spanish
EC|Ecuador|-1.8|-78.2|SA|18.1|Quito|Spanish
GY|Guyana|4.9|-58.9|SA|0.831|Georgetown|English
PY|Paraguay|-23.4|-58.4|SA|6.9|Asunción|Spanish
PE|Peru|-9.2|-75.0|SA|34.4|Lima|Spanish
SR|Suriname|3.9|-56.0|SA|0.634|Paramaribo|Dutch
UY|Uruguay|-32.5|-55.8|SA|3.4|Montevideo|Spanish
VE|Venezuela|6.4|-66.6|SA|28.4|Caracas|Spanish
AU|Australia|-25.3|133.8|OC|27.4|Canberra|English
FJ|Fiji|-17.7|178.1|OC|0.93|Suva|English
KI|Kiribati|1.9|-157.4|OC|0.134|Tarawa|English
MH|Marshall Islands|7.1|171.2|OC|0.0338|Majuro|Marshallese
FM|Micronesia|7.4|150.6|OC|0.115|Palikir|English
NR|Nauru|-0.5|166.9|OC|0.0121|Yaren|Nauruan
NZ|New Zealand|-40.9|174.9|OC|5.32|Wellington|English
PW|Palau|7.5|134.6|OC|0.0179|Ngerulmud|Palauan
PG|Papua New Guinea|-6.3|144.0|OC|10.3|Port Moresby|Tok Pisin
WS|Samoa|-13.8|-172.1|OC|0.22|Apia|Samoan
SB|Solomon Islands|-9.6|160.2|OC|0.77|Honiara|English
TO|Tonga|-21.2|-175.2|OC|0.1|Nuku'alofa|Tongan
TV|Tuvalu|-7.1|177.6|OC|0.0112|Funafuti|Tuvaluan
VU|Vanuatu|-15.4|167.0|OC|0.33|Port Vila|Bislama
`

/**
 * Extra columns per country (Country Wordle): iso2 | UN geoscheme subregion | area (km2) | land borders (iso2, space separated).
 * Borders are land borders between the listed countries only (no overseas territories, Kosovo, Western Sahara, Gaza) and symmetric.
 */
const EXTRA = `
DZ|Northern Africa|2381741|TN LY NE ML MR MA
AO|Middle Africa|1246700|CD CG ZM NA
BJ|Western Africa|114763|TG BF NE NG
BW|Southern Africa|581730|NA ZA ZW ZM
BF|Western Africa|272967|ML NE BJ TG GH CI
BI|Eastern Africa|27834|RW TZ CD
CV|Western Africa|4033|
CM|Middle Africa|475440|NG TD CF CG GQ GA
CF|Middle Africa|622984|TD SD SS CD CG CM
TD|Middle Africa|1284000|LY NE NG CM CF SD
KM|Eastern Africa|1861|
CG|Middle Africa|342000|GA CM CF CD AO
CD|Middle Africa|2344858|CG CF SS UG RW BI TZ ZM AO
CI|Western Africa|322463|LR GN ML BF GH
DJ|Eastern Africa|23200|ER ET SO
EG|Northern Africa|1002000|LY SD IL
GQ|Middle Africa|28051|CM GA
ER|Eastern Africa|117600|SD ET DJ
SZ|Southern Africa|17364|ZA MZ
ET|Eastern Africa|1104300|ER DJ SO KE SS SD
GA|Middle Africa|267668|GQ CM CG
GM|Western Africa|11295|SN
GH|Western Africa|238533|CI BF TG
GN|Western Africa|245857|GW SN ML CI LR SL
GW|Western Africa|36125|SN GN
KE|Eastern Africa|580367|ET SO TZ UG SS
LS|Southern Africa|30355|ZA
LR|Western Africa|111369|SL GN CI
LY|Northern Africa|1759540|TN DZ NE TD SD EG
MG|Eastern Africa|587041|
MW|Eastern Africa|118484|ZM TZ MZ
ML|Western Africa|1240192|DZ NE BF CI GN SN MR
MR|Western Africa|1030700|DZ ML SN
MU|Eastern Africa|2040|
MA|Northern Africa|446550|DZ
MZ|Eastern Africa|801590|TZ MW ZM ZW ZA SZ
NA|Southern Africa|825615|AO ZM BW ZA
NE|Western Africa|1267000|DZ LY TD NG BJ BF ML
NG|Western Africa|923768|BJ NE TD CM
RW|Eastern Africa|26338|UG TZ BI CD
ST|Middle Africa|964|
SN|Western Africa|196722|MR ML GN GW GM
SC|Eastern Africa|452|
SL|Western Africa|71740|GN LR
SO|Eastern Africa|637657|DJ ET KE
ZA|Southern Africa|1221037|NA BW ZW MZ SZ LS
SS|Eastern Africa|619745|SD ET KE UG CD CF
SD|Northern Africa|1861484|EG LY TD CF SS ET ER
TZ|Eastern Africa|945087|KE UG RW BI CD ZM MW MZ
TG|Western Africa|56785|GH BF BJ
TN|Northern Africa|163610|DZ LY
UG|Eastern Africa|241038|SS KE TZ RW CD
ZM|Eastern Africa|752612|CD TZ MW MZ ZW BW NA AO
ZW|Eastern Africa|390757|ZM MZ ZA BW
AF|Southern Asia|652230|PK IR TM UZ TJ CN
AM|Western Asia|29743|GE AZ TR IR
AZ|Western Asia|86600|RU GE AM TR IR
BH|Western Asia|778|
BD|Southern Asia|147570|IN MM
BT|Southern Asia|38394|IN CN
BN|South-Eastern Asia|5765|MY
KH|South-Eastern Asia|181035|TH LA VN
CN|Eastern Asia|9596961|AF BT IN KZ KG KP LA MN MM NP PK RU TJ VN
GE|Western Asia|69700|RU AZ AM TR
IN|Southern Asia|3287263|PK CN NP BT BD MM
ID|South-Eastern Asia|1904569|MY PG TL
IR|Southern Asia|1648195|IQ TR AM AZ TM AF PK
IQ|Western Asia|438317|TR IR KW SA JO SY
IL|Western Asia|22072|EG JO SY LB
JP|Eastern Asia|377975|
JO|Western Asia|89342|SY IQ SA IL
KZ|Central Asia|2724900|RU CN KG UZ TM
KW|Western Asia|17818|IQ SA
KG|Central Asia|199951|KZ UZ TJ CN
LA|South-Eastern Asia|236800|MM CN VN KH TH
LB|Western Asia|10452|SY IL
MY|South-Eastern Asia|330803|TH ID BN
MV|Southern Asia|298|
MN|Eastern Asia|1564116|RU CN
MM|South-Eastern Asia|676578|BD IN CN LA TH
NP|Southern Asia|147181|IN CN
KP|Eastern Asia|120538|CN RU KR
OM|Western Asia|309500|AE SA YE
PK|Southern Asia|881913|IN AF IR CN
PH|South-Eastern Asia|300000|
QA|Western Asia|11586|SA
SA|Western Asia|2149690|JO IQ KW QA AE OM YE
SG|South-Eastern Asia|734|
KR|Eastern Asia|100210|KP
LK|Southern Asia|65610|
SY|Western Asia|185180|TR IQ JO IL LB
TW|Eastern Asia|36193|
TJ|Central Asia|143100|AF CN KG UZ
TH|South-Eastern Asia|513120|MM LA KH MY
TL|South-Eastern Asia|14919|ID
TR|Western Asia|783562|GR BG GE AM AZ IR IQ SY
TM|Central Asia|488100|KZ UZ AF IR
AE|Western Asia|83600|SA OM
UZ|Central Asia|447400|KZ KG TJ AF TM
VN|South-Eastern Asia|331212|CN LA KH
YE|Western Asia|527968|SA OM
AL|Southern Europe|28748|ME MK GR
AD|Southern Europe|468|FR ES
AT|Western Europe|83871|DE CZ SK HU SI IT CH LI
BY|Eastern Europe|207600|RU UA PL LT LV
BE|Western Europe|30528|FR LU DE NL
BA|Southern Europe|51197|HR RS ME
BG|Eastern Europe|110879|RO RS MK GR TR
HR|Southern Europe|56594|SI HU RS BA ME
CY|Western Asia|9251|
CZ|Eastern Europe|78871|DE PL SK AT
DK|Northern Europe|42924|DE
EE|Northern Europe|45228|RU LV
FI|Northern Europe|338424|SE NO RU
FR|Western Europe|551695|BE LU DE CH IT MC ES AD
DE|Western Europe|357022|DK PL CZ AT CH FR LU BE NL
GR|Southern Europe|131957|AL MK BG TR
HU|Eastern Europe|93028|AT SK UA RO RS HR SI
IS|Northern Europe|103000|
IE|Northern Europe|70273|GB
IT|Southern Europe|301340|FR CH AT SI SM VA
LV|Northern Europe|64589|EE LT RU BY
LI|Western Europe|160|CH AT
LT|Northern Europe|65300|LV BY PL RU
LU|Western Europe|2586|BE FR DE
MT|Southern Europe|316|
MD|Eastern Europe|33846|RO UA
MC|Western Europe|2|FR
ME|Southern Europe|13812|HR BA RS AL
NL|Western Europe|41543|BE DE
MK|Southern Europe|25713|AL BG GR RS
NO|Northern Europe|323802|SE FI RU
PL|Eastern Europe|312696|DE CZ SK UA BY LT RU
PT|Southern Europe|92090|ES
RO|Eastern Europe|238397|UA MD BG RS HU
RU|Eastern Europe|17098246|NO FI EE LV LT PL BY UA GE AZ KZ CN MN KP
SM|Southern Europe|61|IT
RS|Southern Europe|77474|HU RO BG MK ME BA HR
SK|Eastern Europe|49035|CZ PL UA HU AT
SI|Southern Europe|20273|IT AT HU HR
ES|Southern Europe|505990|PT FR AD
SE|Northern Europe|450295|NO FI
CH|Western Europe|41285|DE FR IT AT LI
UA|Eastern Europe|603550|PL SK HU RO MD BY RU
GB|Northern Europe|243610|IE
VA|Southern Europe|1|IT
AG|Caribbean|442|
BS|Caribbean|13943|
BB|Caribbean|430|
BZ|Central America|22966|MX GT
CA|Northern America|9984670|US
CR|Central America|51100|NI PA
CU|Caribbean|109884|
DM|Caribbean|751|
DO|Caribbean|48671|HT
SV|Central America|21041|GT HN
GD|Caribbean|344|
GT|Central America|108889|MX BZ HN SV
HT|Caribbean|27750|DO
HN|Central America|112492|GT SV NI
JM|Caribbean|10991|
MX|Central America|1964375|US GT BZ
NI|Central America|130373|HN CR
PA|Central America|75417|CR CO
KN|Caribbean|261|
LC|Caribbean|616|
VC|Caribbean|389|
TT|Caribbean|5130|
US|Northern America|9833517|CA MX
AR|South America|2780400|CL BO PY BR UY
BO|South America|1098581|PE BR PY AR CL
BR|South America|8515767|UY AR PY BO PE CO VE GY SR
CL|South America|756102|PE BO AR
CO|South America|1141748|VE BR PE EC PA
EC|South America|283561|CO PE
GY|South America|214969|VE BR SR
PY|South America|406752|BO BR AR
PE|South America|1285216|EC CO BR BO CL
SR|South America|163820|GY BR
UY|South America|176215|AR BR
VE|South America|916445|CO BR GY
AU|Australia and New Zealand|7692024|
FJ|Melanesia|18272|
KI|Micronesia|811|
MH|Micronesia|181|
FM|Micronesia|702|
NR|Micronesia|21|
NZ|Australia and New Zealand|268021|
PW|Micronesia|459|
PG|Melanesia|462840|ID
WS|Polynesia|2842|
SB|Melanesia|28896|
TO|Polynesia|747|
TV|Polynesia|26|
VU|Melanesia|12189|
`
const EXTRA_BY = new Map(EXTRA.trim().split('\n').map((l) => {
  const [code, sub, area, borders] = l.split('|')
  return [code, { sub, area: +area, borders: borders ? borders.split(' ') : [] }] as const
}))

export interface Country { code: string, name: string, lat: number, lon: number, cont: string, pop: number, capital: string, lang: string, sub: string, area: number, borders: string[] }

export const CONTINENTS: Record<string, string> = { AF: 'Africa', AS: 'Asia', EU: 'Europe', NA: 'North America', SA: 'South America', OC: 'Oceania' }
export const POP_BUCKETS = ['under 1 million', '1 to 10 million', '10 to 50 million', '50 to 100 million', 'over 100 million']

export const COUNTRIES: Country[] = TABLE.trim().split('\n').map((l) => {
  const [code, name, lat, lon, cont, pop, capital, lang] = l.split('|')
  const x = EXTRA_BY.get(code!)
  return { code, name, lat: +lat, lon: +lon, cont, pop: +pop, capital, lang, sub: x?.sub ?? '', area: x?.area ?? 0, borders: x?.borders ?? [] }
})

const BY_CODE = new Map(COUNTRIES.map(c => [c.code, c]))
export const byCode = (code: string) => BY_CODE.get(code)

/** 0..4: under 1 M, 1-10 M, 10-50 M, 50-100 M, over 100 M */
export function popBucket(pop: number): number {
  return pop < 1 ? 0 : pop < 10 ? 1 : pop < 50 ? 2 : pop < 100 ? 3 : 4
}

/** the flag emoji: two regional-indicator letters built from the ISO code (content, not UI chrome); only the fallback, see flagSrc */
export function flagOf(code: string): string {
  return String.fromCodePoint(...[...code].map(ch => 0x1F1E6 + ch.charCodeAt(0) - 65))
}

/** the flag image (flag-icons, MIT, 4:3 SVG in the layer's public/puzzles-flags/); emoji do not render on Windows */
export const flagSrc = (code: string) => `/puzzles-flags/${code.toLowerCase()}.svg`

const rad = (d: number) => d * Math.PI / 180

/** great-circle distance in km */
export function distanceKm(a: Country, b: Country): number {
  const dLat = rad(b.lat - a.lat), dLon = rad(b.lon - a.lon)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2
  return Math.round(12742 * Math.asin(Math.sqrt(h)))
}

/** compass bearing in degrees (0 = north, 90 = east) from a to b */
export function bearing(a: Country, b: Country): number {
  const dLon = rad(b.lon - a.lon)
  const y = Math.sin(dLon) * Math.cos(rad(b.lat))
  const x = Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) - Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(dLon)
  return Math.round((Math.atan2(y, x) * 180 / Math.PI + 360) % 360)
}

/** the countries a daily target is drawn from: 1 million people or more, so nobody has to know Tuvalu */
export const TARGET_POOL = COUNTRIES.filter(c => c.pop >= 1)

/** population in millions as people read it: 380 k, 4.6 M, 1.4 bn */
export function fmtPop(pop: number): string {
  if (pop < 1) return pop < 0.1 ? `${Math.round(pop * 1000)} k` : `${Math.round(pop * 100) * 10} k`
  if (pop < 10) return `${+pop.toFixed(1)} M`
  if (pop < 1000) return `${Math.round(pop)} M`
  return `${+(pop / 1000).toFixed(1)} bn`
}

/** area as people read it: 316 km2, 41.5 k km2, 9.6 M km2 */
export function fmtArea(km2: number): string {
  if (km2 < 1000) return `${km2.toLocaleString('en-US')} km²`
  if (km2 < 1e6) return `${km2 < 1e4 ? +(km2 / 1000).toFixed(1) : Math.round(km2 / 1000)} k km²`
  return `${+(km2 / 1e6).toFixed(1)} M km²`
}

/** population as an exact-looking figure, three significant digits: 83.6 million, 412 thousand, 1.41 billion */
export function fmtPopExact(pop: number): string {
  const n = (v: number) => String(Number(v.toPrecision(3)))
  if (pop >= 1000) return `${n(pop / 1000)} billion`
  if (pop >= 1) return `${n(pop)} million`
  if (pop >= 0.001) return `${n(pop * 1000)} thousand`
  return `${n(pop * 1e6)} people`
}

// --- facts beyond the table (public knowledge, kept here so the games can ask about them) ---

/** countries that drive on the left; everyone else drives on the right */
const LEFT = new Set('AU NZ JP GB IE IN PK BD NP BT LK TH MY SG BN ID TL CY MT MU SC KE TZ UG ZM ZW MW MZ BW NA ZA LS SZ GY SR JM BS BB AG DM GD KN LC VC TT FJ KI NR PG SB TO TV WS MV'.split(' '))
/** no sea coast (UN list of landlocked countries, plus the European microstates) */
const LANDLOCKED = new Set('AF AM AZ AD AT BY BT BO BW BF BI CF TD CZ SZ ET HU KZ KG LA LS LI LU MW ML MD MN NP NE MK PY RW SM RS SK SS TJ TM UG UZ VA ZM ZW CH'.split(' '))
/** the whole country is islands and it shares no land border */
const ISLAND = new Set('AG BS BH BB CV KM CU DM FJ GD IS JM JP KI MV MT MH MU FM NR NZ PW PH WS ST SC SG SB LK TW TO TT TV VU MG'.split(' '))

export const isLandlocked = (c: Country) => LANDLOCKED.has(c.code)

/** the best-known countries: what the easy Country Wordle draws its answer from */
export const EASY_CODES = new Set('US CA MX BR AR CL CO PE VE CU JM BO EC UY PA CR GB IE FR DE IT ES PT NL BE CH AT SE NO DK FI IS PL CZ HU GR TR RU UA RO HR RS BG EG MA DZ NG ET KE ZA GH TZ SN TN LY AO SD CD MG UG SA IR IQ IL AE JO IN CN JP KR KP TH VN ID MY SG PH PK BD AF NP LK MN KZ AU NZ'.split(' '))
export const EASY_POOL = COUNTRIES.filter(c => EASY_CODES.has(c.code))

export const drivingSide = (c: Country): 'left' | 'right' => (LEFT.has(c.code) ? 'left' : 'right')
export const coastKind = (c: Country): 'landlocked' | 'island' | 'coastal' => (LANDLOCKED.has(c.code) ? 'landlocked' : ISLAND.has(c.code) ? 'island' : 'coastal')

/** other names people type */
const ALT: Record<string, string> = {
  US: 'USA|America|United States of America|US', GB: 'UK|Britain|Great Britain|England|Scotland|Wales', CZ: 'Czech Republic',
  CI: 'Cote d\'Ivoire|Cote dIvoire', KR: 'Korea|Republic of Korea', KP: 'Korea|DPRK', CD: 'Congo|DRC|Congo-Kinshasa|Democratic Republic of the Congo',
  CG: 'Congo|Congo-Brazzaville|Congo Brazzaville', MM: 'Burma', SZ: 'Swaziland', TL: 'East Timor|Timor Leste', CV: 'Cape Verde',
  AE: 'UAE|Emirates', VA: 'Vatican|Holy See', TR: 'Turkiye', MK: 'Macedonia', BA: 'Bosnia', ST: 'Sao Tome|Principe', PG: 'PNG',
  NL: 'Holland', DE: 'Deutschland', SA: 'KSA|Saudi', FM: 'Federated States of Micronesia', BS: 'The Bahamas', GM: 'The Gambia',
  CF: 'CAR', DO: 'Dominican', KN: 'St Kitts|Nevis', LC: 'St Lucia', VC: 'St Vincent', AG: 'Antigua', TT: 'Trinidad|Tobago', BN: 'Brunei Darussalam',
  RU: 'Russian Federation', SY: 'Syrian Arab Republic', IR: 'Persia', LA: 'Lao PDR', VN: 'Viet Nam', CH: 'Schweiz|Suisse', AT: 'Osterreich',
}

/** lower case, no accents, punctuation as a single space ("Côte d'Ivoire" -> "cote d ivoire") */
export const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

const INDEX = COUNTRIES.map(c => ({ c, name: norm(c.name), alts: (ALT[c.code] ?? '').split('|').filter(Boolean).map(norm) }))

/**
 * countries matching what the player typed, best first: an alternate name equals it (USA, UK), the name starts with it,
 * a word of the name starts with it, an alternate name starts with it, anywhere in the name last. `skip` = already guessed.
 */
export function findCountries(q: string, skip: readonly string[] = [], limit = 8): Country[] {
  const s = norm(q)
  if (!s) return []
  const out: { c: Country, rank: number }[] = []
  for (const { c, name, alts } of INDEX) {
    if (skip.includes(c.code)) continue
    let rank = -1
    if (alts.includes(s)) rank = 0
    else if (name.startsWith(s)) rank = 1
    else if (name.split(' ').some(w => w.startsWith(s))) rank = 2
    else if (alts.some(a => a.startsWith(s))) rank = 3
    else if (name.includes(s)) rank = 4
    if (rank >= 0) out.push({ c, rank })
  }
  return out.sort((a, b) => a.rank - b.rank || a.c.name.localeCompare(b.c.name)).slice(0, limit).map(o => o.c)
}
