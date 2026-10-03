/* Solarplaner – Standardwerte (aus MK_37_Module.xlsx übernommen) */
(function () {
  'use strict';

  const IMG = {
    aiko: 'https://cdn.shopify.com/s/files/1/0764/3365/4072/files/sh24_Modul_Aiko_465W_Einzel.webp?v=1738013584',
    wallbox: 'https://cdn.shopify.com/s/files/1/0764/3365/4072/files/sh24_sungrow_AC22E-01.webp?v=1738749639',
    ihome: 'https://cdn.shopify.com/s/files/1/0911/0323/2278/files/SungrowiHomeManager.png?v=1757921665',
    hook: 'https://cdn.shopify.com/s/files/1/0764/3365/4072/files/sh24_K2_Dachhaken_SingleHook_3S.webp?v=1736490827',
    rail: 'https://cdn.shopify.com/s/files/1/0764/3365/4072/files/sh24_K2_Schiene_ff2d3879-c992-40c7-a218-3b4b2ee2fc4e.webp?v=1736492560',
    mid: 'https://cdn.shopify.com/s/files/1/0764/3365/4072/files/400.401.331_sh24_K2_DomeClamp_Mittelklemme.webp?v=1788433948',
    end: 'https://cdn.shopify.com/s/files/1/0764/3365/4072/files/sh24_K2_Clamp_EC_Black_25-40mm_400.401.317.webp?v=1780657463',
    conn: 'https://cdn.shopify.com/s/files/1/0764/3365/4072/files/sh24_K2-SchienenverbinderSingleRail-36-Set_400.401.097_886cd2e5-c015-4480-92d7-4c667f142a4a.webp?v=1788266981'
  };

  const CDN1 = 'https://cdn.shopify.com/s/files/1/0911/0323/2278/files/';

  // Wechselrichter-Bibliothek. SH8.0RT / SG8.0RT mit den Preisen aus der Excel,
  // alle weiteren mit Shop-Preisen (1asol.de / solarhandel24.de, Stand 03.10.2026).
  const INVERTERS = [
    { id: 'sg-sh80rt', brand: 'Sungrow', model: 'SH8.0RT', title: 'Sungrow SH8.0RT-20 V11 Hybrid-Wechselrichter 8 kW', type: 'Hybrid', kw: 8, price: 769,
      url: 'https://1asol.de/products/sungrow-sh80rt-hybrid-wechselrichter-8-kw?variant=49727590727958', img: CDN1 + 'Sungrow_SH8.0RT_Hybrid_Wechselrichter_8_kW_1.png?v=1750886405' },
    { id: 'sg-sg80rt', brand: 'Sungrow', model: 'SG8.0RT', title: 'Sungrow SG8.0RT-V115 String-Wechselrichter mit Internet-Modul – 8 kW', type: 'String', kw: 8, price: 328,
      url: 'https://weecoo.de/Sungrow-SG80RT-V115-String-Wechselrichter-mit-Internet-Modul-8-kW-ASG01778-SG8RT', img: CDN1 + 'Sungrow_SG8.0RT_Wechselrichter_8_kW_1.png?v=1750886382' },
    { id: 'sg-sh50rt', brand: 'Sungrow', model: 'SH5.0RT', title: 'Sungrow SH5.0RT-20 V11 Hybrid-Wechselrichter 5 kW inkl. Smart Meter', type: 'Hybrid', kw: 5, price: 863.90,
      url: 'https://1asol.de/products/sungrow-sh50rt-hybrid-wechselrichter-5-kw?variant=49727585190166', img: CDN1 + 'Sungrow_SH5.0RT_Hybrid_Wechselrichter_5_kW_1.png?v=1750886423' },
    { id: 'sg-sh60rt', brand: 'Sungrow', model: 'SH6.0RT', title: 'Sungrow SH6.0RT-20 V11 Hybrid-Wechselrichter 6 kW inkl. Smart Meter', type: 'Hybrid', kw: 6, price: 733.90,
      url: 'https://1asol.de/products/sungrow-sh60rt-hybrid-wechselrichter-6-kw?variant=49727586828566', img: CDN1 + 'Sungrow_SH6.0RT_Hybrid_Wechselrichter_6_kW_1.png?v=1750886414' },
    { id: 'sg-sh100rt', brand: 'Sungrow', model: 'SH10RT', title: 'Sungrow Hybrid SH10.0RT-20 inkl. Smartmeter v112 10 kW', type: 'Hybrid', kw: 10, price: 882,
      url: 'https://1asol.de/products/sungrow-sh100rt-20-hybrid-wechselrichter-10-kw?variant=49727584108822', img: CDN1 + 'Sungrow_SH10.0RT-20_Hybrid_Wechselrichter_10_kW_1.png?v=1762604914' },
    { id: 'sg-sh15t', brand: 'Sungrow', model: 'SH15T', title: 'Sungrow Hybrid SH15T inkl. Smartmeter v11 15 kW', type: 'Hybrid', kw: 15, price: 1592.70,
      url: 'https://1asol.de/products/sungrow-sh15t-hybrid-wechselrichter-15-kw?variant=49727660163350', img: CDN1 + 'Sungrow_SH15T_Hybrid_Wechselrichter_15_kW_7.png?v=1750886303' },
    { id: 'sg-sg50rt', brand: 'Sungrow', model: 'SG5.0RT', title: 'Sungrow SG5.0RT Wechselrichter 5 kW', type: 'String', kw: 5, price: 390,
      url: 'https://1asol.de/products/sungrow-sg50rt-wechselrichter-5-kw?variant=49727591907606', img: CDN1 + 'Sungrow_SG5.0RT_Wechselrichter_5_kW_1.png?v=1750886398' },
    { id: 'sg-sg60rt', brand: 'Sungrow', model: 'SG6.0RT', title: 'Sungrow SG6.0RT-V115 Wechselrichter 6 kW', type: 'String', kw: 6, price: 399,
      url: 'https://1asol.de/products/sungrow-sg60rt-wechselrichter-6-kw?variant=49727628673302', img: CDN1 + 'Sungrow_SG6.0RT_Wechselrichter_6_kW_1.png?v=1750886392' },
    { id: 'sg-sg100rt', brand: 'Sungrow', model: 'SG10RT', title: 'Sungrow SG10.0RT-V115 Wechselrichter 10 kW', type: 'String', kw: 10, price: 549,
      url: 'https://1asol.de/products/sungrow-sg100rt-wechselrichter-10-kw?variant=49727630737686', img: CDN1 + 'Sungrow_SG10.0RT_Wechselrichter_10_kW_1.png?v=1750886373' },
    { id: 'sg-sg120rt', brand: 'Sungrow', model: 'SG12RT', title: 'Sungrow SG12.0RT-V115 Wechselrichter 12 kW', type: 'String', kw: 12, price: 569,
      url: 'https://1asol.de/products/sungrow-sg120rt-wechselrichter-12-kw?variant=49727631393046', img: CDN1 + 'Sungrow_SG12.0RT_Wechselrichter_12_kW_1.png?v=1750886365' },
    { id: 'sg-sg150rt', brand: 'Sungrow', model: 'SG15RT', title: 'Sungrow SG15.0RT-V115 Wechselrichter 15 kW', type: 'String', kw: 15, price: 628.90,
      url: 'https://1asol.de/products/sungrow-sg150rt-wechselrichter-15-kw?variant=49727632408854', img: CDN1 + 'Sungrow_SG15.0RT_Wechselrichter_15_kW_1.png?v=1750886354' },
    { id: 'fr-gen24-8', brand: 'Fronius', model: 'Symo GEN24 8.0 Plus', title: 'Fronius Symo GEN24 SC 8.0 Plus Hybrid-Wechselrichter 8 kW', type: 'Hybrid', kw: 8, price: 2290,
      url: 'https://1asol.de/products/fronius-symo-gen24-8-0-plus-hybrid-wechselrichter-8kw?variant=49727689851158', img: CDN1 + 'fronius-symo-gen24-sc-8-0-plus-hybrid-wechselrichter-8-kw.png?v=1783440542' },
    { id: 'fr-gen24-10', brand: 'Fronius', model: 'Symo GEN24 10.0 Plus', title: 'Fronius Symo GEN24 SC 10.0 Plus Hybrid-Wechselrichter 10 kW', type: 'Hybrid', kw: 10, price: 2313,
      url: 'https://1asol.de/products/fronius-symo-gen24-10-0-plus-hybrid-wechselrichter-10kw?variant=49727688802582', img: CDN1 + 'fronius-symo-gen24-sc-10-0-plus-hybrid-wechselrichter-10-kw.png?v=1783440542' },
    { id: 'hw-8ktl', brand: 'Huawei', model: 'SUN2000-8KTL-M1', title: 'Huawei SUN2000-8KTL-M1 HC Hybrid Wechselrichter 8 kW', type: 'Hybrid', kw: 8, price: 760.74,
      url: 'https://1asol.de/products/huawei-sun2000-8ktl-m1-hc-hybrid-wechselrichter-8-kw?variant=49727535415574', img: CDN1 + 'Huawei_SUN2000-8KTL-M1_HC_Hybrid_Wechselrichter_8_kW_1.png?v=1750886587' },
    { id: 'hw-10ktl', brand: 'Huawei', model: 'SUN2000-10KTL-M1', title: 'Huawei SUN2000-10KTL-M1 HC Hybrid Wechselrichter 10 kW', type: 'Hybrid', kw: 10, price: 899.90,
      url: 'https://1asol.de/products/huawei-sun2000-10ktl-m1-hc-hybrid-wechselrichter-10-kw?variant=49727537086742', img: CDN1 + 'Huawei_SUN2000-10KTL-M1_HC_Hybrid_Wechselrichter_10_kW_1.png?v=1750886595' },
    { id: 'sma-se8', brand: 'SMA', model: 'STP 8.0 Smart Energy', title: 'SMA Sunny Tripower Smart Energy 8.0 Hybrid-Wechselrichter 8 kW', type: 'Hybrid', kw: 8, price: 1089.75,
      url: 'https://1asol.de/products/sma-sunny-tripower-smart-energy-8-0-hybrid-wechselrichter?variant=49727671304470', img: CDN1 + 'sma-sunny-tripower-smart-energy-8-0-hybrid-wechselrichter-8-kw.png?v=1783509791' },
    { id: 'sma-se10', brand: 'SMA', model: 'STP 10.0 Smart Energy', title: 'SMA Sunny Tripower Smart Energy 10.0 Hybrid-Wechselrichter 10 kW', type: 'Hybrid', kw: 10, price: 1834.10,
      url: 'https://1asol.de/products/sma-sunny-tripower-smart-energy-10-0-hybrid-wechselrichter?variant=49727670976790', img: CDN1 + 'sma-sunny-tripower-smart-energy-10-0-hybrid-wechselrichter-10-kw.png?v=1783507344' },
    { id: 'sma-stp10', brand: 'SMA', model: 'STP 10.0', title: 'SMA Sunny Tripower STP 10.0 String-Wechselrichter 10 kW', type: 'String', kw: 10, price: 529,
      url: 'https://1asol.de/products/sma-sunny-tripower-stp-10-0-solar-wechselrichter?variant=49727676055830', img: CDN1 + 'sma-sunny-tripower-stp-10-0-string-wechselrichter-10-kw.png?v=1783517785' },
    { id: 'kostal-g3m', brand: 'Kostal', model: 'Plenticore G3 M', title: 'Kostal G3 M Plenticore 8,5 bis 12,5 kW Wechselrichter', type: 'Hybrid', kw: 10, price: 1699,
      url: 'https://solarhandel24.de/products/kostal-plenticore-g3-m?variant=49170129256760', img: 'https://cdn.shopify.com/s/files/1/0764/3365/4072/files/sh24_Kostal_Plenticore_G3_M.webp?v=1736496312' }
  ];

  // Modulkatalog von solarhandel24.de (Snapshot vom 03.10.2026 als Offline-Fallback –
  // im Browser wird er automatisch live aus dem Shop aktualisiert).
  // tiers = Staffelpreise [ab Stückzahl, Preis je Modul]; palletPrice = Preis für eine ganze Palette.
  const MODULE_CATALOG = [{"id":"aiko-solar-460w-glas-glas-full-black-modul-aiko-a-mah54db-neostar-2s-einzelpreis","brand":"AIKO","title":"AIKO Solar 460W Glas-Glas Full Black Modul AIKO-A-MAH54Db Neostar 2S+","wp":460,"heightMm":1757,"widthMm":1134,"img":"https://cdn.shopify.com/s/files/1/0764/3365/4072/files/sh24_Modul_Aiko_460W_Einzel.webp?v=1736424426","tiers":[[1,82.9],[6,81.9],[15,80.9],[37,79.9]],"singleUrl":"https://solarhandel24.de/products/aiko-solar-460w-glas-glas-full-black-modul-aiko-a-mah54db-neostar-2s-einzelpreis?variant=47756236095800","palletQty":37,"palletPrice":2956.3,"palletUrl":"https://solarhandel24.de/products/aiko-solar-glas-glas-full-black-modul-460w-aiko-a-mah54db-neostar-2s-palettenpreis-37-stk?variant=47591783432504","available":true,"weightKg":24.5,"palletWeightKg":906.5},{"id":"aiko-solar-465w-glas-glas-full-black-modul-aiko-a-mah54db-neostar-2s-staffelpreis","brand":"AIKO","title":"AIKO Solar 465W Glas-Glas Full Black Modul AIKO-A-MAH54Db Neostar 2S+","wp":465,"heightMm":1757,"widthMm":1134,"img":"https://cdn.shopify.com/s/files/1/0764/3365/4072/files/sh24_Modul_Aiko_465W_Einzel.webp?v=1738013584","tiers":[[1,86.9],[6,85.9],[15,84.9],[37,83.9]],"singleUrl":"https://solarhandel24.de/products/aiko-solar-465w-glas-glas-full-black-modul-aiko-a-mah54db-neostar-2s-staffelpreis?variant=54935747330434","palletQty":37,"palletPrice":3104.3,"palletUrl":"https://solarhandel24.de/products/aiko-solar-465w-glas-glas-full-black-modul-aiko-a-mah54db-neostar-2s-palettenpreis-36-stk?variant=54935757390210","available":true,"weightKg":24.5,"palletWeightKg":906.5},{"id":"aiko-solar-470w-black-frame-aiko-a-mah54dw-neostar-2p-staffelpreis","brand":"AIKO","title":"AIKO Solar 470W Glas-Glas Black Frame AIKO-A-MAH54Dw Neostar 2P+","wp":470,"heightMm":1757,"widthMm":1134,"img":"https://cdn.shopify.com/s/files/1/0764/3365/4072/files/sh24_Modul_Aiko_470W_BF_Einzel.webp?v=1736514457","tiers":[[1,77.9],[6,76.9],[15,75.9],[37,74.9]],"singleUrl":"https://solarhandel24.de/products/aiko-solar-470w-black-frame-aiko-a-mah54dw-neostar-2p-staffelpreis?variant=54903905354114","palletQty":37,"palletPrice":2771.3,"palletUrl":"https://solarhandel24.de/products/aiko-solar-470w-glas-glas-black-frame-aiko-a-mah54dw-neostar-2p-palettenpreis-37-stk?variant=54904027349378","available":true,"weightKg":24.5,"palletWeightKg":906.5},{"id":"aiko-480w-neostar-3s-54-glas-glas","brand":"AIKO","title":"AIKO Solar 480W Dual Glass Full Black Modul AIKO-A480-MCE54Db Neostar 3S+54","wp":480,"heightMm":1762,"widthMm":1134,"img":"https://cdn.shopify.com/s/files/1/0764/3365/4072/files/sh24_Modul_MCE54Db_Neostar_3S__480W_Einzel.webp?v=1768309434","tiers":[[1,112.9],[6,111.9],[15,110.9],[37,109.9]],"singleUrl":"https://solarhandel24.de/products/aiko-480w-neostar-3s-54-glas-glas?variant=56201939353986","palletQty":37,"palletPrice":4066.3,"palletUrl":"https://solarhandel24.de/products/aiko-neostar-3s-54-480w-glas-glas-full-black-palette-37-stk?variant=56202078126466","available":true,"weightKg":24.5,"palletWeightKg":943.5},{"id":"aiko-485w-full-black-aiko-a485-mce54db-neostar-3s","brand":"AIKO","title":"AIKO 485W Full Black AIKO-A485-MCE54Db Neostar 3S+54","wp":485,"heightMm":1762,"widthMm":1134,"img":"https://cdn.shopify.com/s/files/1/0764/3365/4072/files/sh24_Modul_MCE54Db_Neostar_3S__485W_Einzel.webp?v=1768296151","tiers":[[1,119.9],[6,118.9],[15,117.9],[37,116.9]],"singleUrl":"https://solarhandel24.de/products/aiko-485w-full-black-aiko-a485-mce54db-neostar-3s?variant=56036645536130","palletQty":37,"palletPrice":4325.3,"palletUrl":"https://solarhandel24.de/products/aiko-485w-full-black-aiko-a485-mce54db-neostar-3s-54-palette?variant=56036824187266","available":true,"weightKg":25.5,"palletWeightKg":943.5},{"id":"aiko-solar-485w-glas-glas-black-frame-modul-aiko-a485-grh48dw-neostar-2p-48","brand":"AIKO","title":"AIKO Solar 485W Glas-Glas Black Frame Modul AIKO-A485-GRH48Dw Neostar 2P+48","wp":485,"heightMm":1762,"widthMm":1134,"img":"https://cdn.shopify.com/s/files/1/0764/3365/4072/files/100.101.024_sh24_Modul_Aiko_Neostar_2P__485W_Einzel.webp?v=1787232763","tiers":[[1,89.9],[6,88.9],[15,87.9],[37,86.9]],"singleUrl":"https://solarhandel24.de/products/aiko-solar-485w-glas-glas-black-frame-modul-aiko-a485-grh48dw-neostar-2p-48?variant=56860598337922","palletQty":37,"palletPrice":3215.3,"palletUrl":"https://solarhandel24.de/products/aiko-solar-485w-glas-glas-black-frame-modul-aiko-a485-grh48dw-neostar-2p-48-palettenpreis-37-stk?variant=56862190502274","available":true,"weightKg":24.1,"palletWeightKg":891.7},{"id":"aiko-solar-500w-dual-glass-full-black-modul-a500-mah60db-neostar-2s-staffelpreis","brand":"AIKO","title":"AIKO Solar 500W Glas-Glas Full Black Modul A500-MAH60Db NEOSTAR 2S+","wp":500,"heightMm":1954,"widthMm":1134,"img":"https://cdn.shopify.com/s/files/1/0764/3365/4072/files/sh24_Modul_Aiko_Neostar-2_-500W_Einzel.webp?v=1758535271","tiers":[[1,92.9],[6,91.9],[15,90.9],[37,89.9]],"singleUrl":"https://solarhandel24.de/products/aiko-solar-500w-dual-glass-full-black-modul-a500-mah60db-neostar-2s-staffelpreis?variant=55691525161346","palletQty":37,"palletPrice":3326.3,"palletUrl":"https://solarhandel24.de/products/aiko-solar-500w-dual-glass-full-black-modul-a500-mah60db-neostar-2s-palettenpreis-37-stk?variant=55691643847042","available":true,"weightKg":26.5,"palletWeightKg":980.5},{"id":"aiko-solar-530w-full-black-modul-mce60db-neostar-3s-60","brand":"AIKO","title":"AIKO Solar 530W Glas-Glas Full Black Modul AIKO-A530-MCE60Db Neostar 3S+60","wp":530,"heightMm":1954,"widthMm":1134,"img":"https://cdn.shopify.com/s/files/1/0764/3365/4072/files/sh24_Modul_AIKO-FB_530W_Einzel_100.101.019.webp?v=1776925912","tiers":[[1,109.9],[6,108.9],[15,107.9],[37,106.9]],"singleUrl":"https://solarhandel24.de/products/aiko-solar-530w-full-black-modul-mce60db-neostar-3s-60?variant=56585361719682","palletQty":37,"palletPrice":3955.3,"palletUrl":"https://solarhandel24.de/products/aiko-solar-530w-full-black-modul-mce60db-neostar-3s-60-palette?variant=56585365946754","available":true,"weightKg":27.1,"palletWeightKg":1002.7},{"id":"aiko-535w-full-black-neostar-3s-plus","brand":"AIKO","title":"AIKO Solar 535W Glas-Glas Full Black Modul AIKO-A535-MCE60Db Neostar 3S+60","wp":535,"heightMm":1954,"widthMm":1134,"img":"https://cdn.shopify.com/s/files/1/0764/3365/4072/files/sh24_Modul_AIKO-FB_535W_Einzel_100.101.016.webp?v=1771499063","tiers":[[1,119.9],[6,118.9],[15,117.9],[37,116.9]],"singleUrl":"https://solarhandel24.de/products/aiko-535w-full-black-neostar-3s-plus?variant=56360019001730","palletQty":37,"palletPrice":4325.3,"palletUrl":"https://solarhandel24.de/products/aiko-535w-full-black-neostar-3s-plus-palette-37?variant=56374378529154","available":true,"weightKg":27.1,"palletWeightKg":1002.7},{"id":"aiko-540w-full-black-neostar-3s-plus","brand":"AIKO","title":"AIKO Solar 540W Glas-Glas Full Black Modul AIKO-A540-MCE60Db Neostar 3S+60","wp":540,"heightMm":1954,"widthMm":1134,"img":"https://cdn.shopify.com/s/files/1/0764/3365/4072/files/sh24_Modul_AIKO-FB_540W_Einzel_100.101.017.webp?v=1771497678","tiers":[[1,125.9],[6,124.9],[15,123.9],[37,122.9]],"singleUrl":"https://solarhandel24.de/products/aiko-540w-full-black-neostar-3s-plus?variant=56374551478658","palletQty":37,"palletPrice":4547.3,"palletUrl":"https://solarhandel24.de/products/aiko-540w-full-black-neostar-3s-plus-palette-37?variant=56374597714306","available":true,"weightKg":27.1,"palletWeightKg":1002.7},{"id":"aiko-solar-545w-black-frame-modul-mce60dw-neostar-3p-60w","brand":"AIKO","title":"AIKO Solar 545W Glas-Glas Black Frame Modul AIKO-A545-MCE60Dw Neostar 3P+60w","wp":545,"heightMm":1954,"widthMm":1134,"img":"https://cdn.shopify.com/s/files/1/0764/3365/4072/files/sh24_Modul_AIKO-BF_545W_MCE60Dw_Einzel_100.101.021.webp?v=1779950130","tiers":[[1,112.9],[6,111.9],[15,110.9],[37,109.9]],"singleUrl":"https://solarhandel24.de/products/aiko-solar-545w-black-frame-modul-mce60dw-neostar-3p-60w?variant=56675818013058","palletQty":37,"palletPrice":4066.3,"palletUrl":"https://solarhandel24.de/products/aiko-solar-545w-black-frame-modul-mce60dw-neostar-3p-60w-palette?variant=56675826762114","available":true,"weightKg":27.1,"palletWeightKg":1002.7},{"id":"ja-solar-455w-bifazial-glas-glas-full-black","brand":"JA Solar","title":"JA Solar 455W Bifazial Glas-Glas Full Black JAM54D41 LB","wp":455,"heightMm":1762,"widthMm":1134,"img":"https://cdn.shopify.com/s/files/1/0764/3365/4072/files/sh24_Modul_JA_Solar-455W_FB_Einzel.webp?v=1768922351","tiers":[[1,70.9],[6,69.9],[15,68.9],[36,67.9]],"singleUrl":"https://solarhandel24.de/products/ja-solar-455w-bifazial-glas-glas-full-black?variant=56225653752194","palletQty":36,"palletPrice":2444.4,"palletUrl":"https://solarhandel24.de/products/ja-solar-455w-bifazial-glas-glas-full-black-palette-36?variant=56226005614978","available":true,"weightKg":22.0,"palletWeightKg":792.0},{"id":"ja-solar-460w-bifazial-glas-glas-black-frame-jam54d40-staffelpreis","brand":"JA Solar","title":"Ja Solar 460W Bifazial Glas-Glas Black Frame JAM54D40","wp":460,"heightMm":1762,"widthMm":1134,"img":"https://cdn.shopify.com/s/files/1/0764/3365/4072/files/sh24_Modul_Ja_Solar_460W_einzel.webp?v=1754899817","tiers":[[1,67.9],[6,66.9],[15,65.9],[36,64.9]],"singleUrl":"https://solarhandel24.de/products/ja-solar-460w-bifazial-glas-glas-black-frame-jam54d40-staffelpreis?variant=55488969834882","palletQty":36,"palletPrice":2336.4,"palletUrl":"https://solarhandel24.de/products/ja-solar-460w-bifazial-glas-glas-black-frame-jam54d40-palettenpreis-36-stk?variant=55489141866882","available":true,"weightKg":22.0,"palletWeightKg":792.0},{"id":"ja-solar-460w-glas-glas-full-black-jam54d41-lr","brand":"JA Solar","title":"Ja Solar 460W Full Black JAM54D41 LR","wp":460,"heightMm":1762,"widthMm":1134,"img":"https://cdn.shopify.com/s/files/1/0764/3365/4072/files/sh24_Modul_Ja_Solar-460W_FB_JAM54D41-460_LR_Einzel_100.102.011.webp?v=1776861188","tiers":[[1,72.9],[6,71.9],[15,70.9],[36,69.9]],"singleUrl":"https://solarhandel24.de/products/ja-solar-460w-glas-glas-full-black-jam54d41-lr?variant=56556727075202","palletQty":36,"palletPrice":2516.4,"palletUrl":"https://solarhandel24.de/products/ja-solar-460w-glas-glas-full-black-jam54d41-lr-palette?variant=56556762300802","available":true,"weightKg":22.0,"palletWeightKg":792.0},{"id":"ja-solar-465w-bifazial-black-frame-jam54d40-lb","brand":"JA Solar","title":"Ja Solar 465W Bifazial Glas-Glas Black Frame JAM54D40-LB","wp":465,"heightMm":1762,"widthMm":1134,"img":"https://cdn.shopify.com/s/files/1/0764/3365/4072/files/sh24_Modul_Ja_Solar_465W_JAM54D40-465-LB_Einzel_100.102.015.webp?v=1779873333","tiers":[[1,67.9],[6,66.9],[15,65.9],[36,64.9]],"singleUrl":"https://solarhandel24.de/products/ja-solar-465w-bifazial-black-frame-jam54d40-lb?variant=56592154427778","palletQty":36,"palletPrice":2336.4,"palletUrl":"https://solarhandel24.de/products/ja-solar-465w-bifazial-black-frame-jam54d40-lb-palette?variant=56592201941378","available":true,"weightKg":22.0,"palletWeightKg":792.0},{"id":"ja-solar-465w-black-frame-jam54d40-lr-staffelpreis","brand":"JA Solar","title":"Ja Solar 465W Black Frame JAM54D40 LR","wp":465,"heightMm":1762,"widthMm":1134,"img":"https://cdn.shopify.com/s/files/1/0764/3365/4072/files/sh24_Modul_Ja_Solar-465W_BF_JAM54D40-465_LR_Einzel_100.102.012.webp?v=1776861378","tiers":[[1,70.9],[6,69.9],[15,68.9],[36,67.9]],"singleUrl":"https://solarhandel24.de/products/ja-solar-465w-black-frame-jam54d40-lr-staffelpreis?variant=56556799066498","palletQty":36,"palletPrice":2444.4,"palletUrl":"https://solarhandel24.de/products/ja-solar-465w-black-frame-jam54d40-lr-palettenpreis-36-stk?variant=56556821840258","available":true,"weightKg":22.0,"palletWeightKg":792.0},{"id":"ja-solar-470w-black-frame-jam54d40-lr-staffelpreis","brand":"JA Solar","title":"Ja Solar 470W Black Frame JAM54D40 LR","wp":470,"heightMm":1762,"widthMm":1134,"img":"https://cdn.shopify.com/s/files/1/0764/3365/4072/files/sh24_Modul_Ja_Solar-470W_BF_JAM54D40-465_LR_Einzel_100.102.013.webp?v=1776861536","tiers":[[1,72.9],[6,71.9],[15,70.9],[36,69.9]],"singleUrl":"https://solarhandel24.de/products/ja-solar-470w-black-frame-jam54d40-lr-staffelpreis?variant=56556874465666","palletQty":36,"palletPrice":2516.4,"palletUrl":"https://solarhandel24.de/products/ja-solar-470w-black-frame-jam54d40-lr-palette?variant=56556970967426","available":true,"weightKg":22.0,"palletWeightKg":792.0},{"id":"ja-solar-500w-bifazial-glas-glas-full-black-jam60d41-lb-staffelpreis","brand":"JA Solar","title":"Ja Solar 500W Bifazial Glas-Glas Full Black JAM60D41 LB","wp":500,"heightMm":1953,"widthMm":1134,"img":"https://cdn.shopify.com/s/files/1/0764/3365/4072/files/sh24_Modul_JA_Solar-500W_Einzel.webp?v=1738850216","tiers":[[1,77.9],[6,76.9],[15,75.9],[36,74.9]],"singleUrl":"https://solarhandel24.de/products/ja-solar-500w-bifazial-glas-glas-full-black-jam60d41-lb-staffelpreis?variant=54950089752962","palletQty":36,"palletPrice":2696.4,"palletUrl":"https://solarhandel24.de/products/ja-solar-500w-bifazial-glas-glas-full-black-jam60d41-lb-palettenpreis-36-stk?variant=54950158172546","available":true,"weightKg":27.3,"palletWeightKg":982.8}];

  // Versandkosten solarhandel24.de nach Gesamtgewicht (Quelle: /policies/shipping-policy, Stand 03.10.2026).
  // Gegen den echten Checkout geprüft: 1 Palette AIKO 465 (906,5 kg) = 169 €, 4 Module (98 kg) = 69 €,
  // 2 Paletten (1.813 kg) = 269 €, 4 Paletten (3.626 kg) = 549 € per LKW, 1 einzelnes Modul = 49 € Kurier.
  const SHIP_TABLE = {
    source: 'solarhandel24.de', checkedAt: '2026-10-03',
    url: 'https://solarhandel24.de/policies/shipping-policy',
    courierSingle: 49,      // genau 1 Modul: versicherter Kurierversand
    moduleMin: 69,          // Spedition mit Modulen: mindestens 69 € (Checkout: 2–4 Module = 69 €)
    longGoods: 79,          // Langgutzuschlag ab 2,40 m (z. B. Montageschienen)
    freight: [[50, 59], [100, 69], [150, 79], [200, 89], [250, 99], [350, 109], [500, 119], [600, 129], [750, 139], [875, 159], [1000, 169],
      [1250, 199], [1500, 219], [1750, 249], [2000, 269], [2250, 299], [2500, 319], [2750, 339], [3000, 349]],
    direct: [[3500, 499], [4000, 549], [4500, 579], [5000, 599], [5500, 649], [6000, 699], [7000, 749], [8000, 799], [10000, 899], [13000, 999], [18000, 1049], [24000, 1199]]
  };

  function create() {
    return {
      version: 1,
      project: { name: 'MK_37_Module', note: '' },
      modules: {
        count: 37,
        source: 'shop',          // shop = Modul aus dem solarhandel24-Katalog, manual = eigene Angaben
        productId: 'aiko-solar-465w-glas-glas-full-black-modul-aiko-a-mah54db-neostar-2s-staffelpreis',
        buyMode: 'mixed',        // single = Einzeln (Staffelpreis), pallet = ganze Paletten, mixed = günstigste Kombination
        buyModeV: 2,
        name: 'AIKO-A465-MA54DB',
        title: 'Aiko Solar 465W Modul AIKO-A-MAH54Db Neostar 2S+',
        wp: 465,
        price: 82,
        url: 'https://solarhandel24.de/products/aiko-solar-465w-glas-glas-full-black-modul-aiko-a-mah54db-neostar-2s-staffelpreis?variant=54935747559810',
        img: IMG.aiko,
        widthMm: 1134,
        heightMm: 1757,
        weightKg: 24.5,
        shipping: { mode: 'shop24', amount: 169, palletSize: 37 }
      },
      inverters: [
        { id: 'slot1', libId: 'sg-sh80rt', qty: 1 },
        { id: 'slot2', libId: 'sg-sg80rt', qty: 1 }
      ],
      components: [
        { id: 'wallbox', label: 'Wallbox', name: 'Sungrow 22kW', title: 'Sungrow AC22E-01 Wallbox 22 kW – PV-Überschussladen, RFID, 7 m', qty: 1, price: 679, category: 'wallbox', enabled: true,
          url: 'https://weecoo.de/Sungrow-EV-Charger-22kW-Wallbox-AC22E-01-G-A0CH1085', img: IMG.wallbox },
        { id: 'storage', label: 'Speicher', name: 'Pylontech Force H3 (10,2 kWh)', title: 'PYLONTECH Force H3 10,2 kWh', qty: 1, price: 2167, category: 'storage', enabled: true,
          url: 'https://husatech.de/Pylontech-Force-H3-102-kWh', img: '' },
        { id: 'ihome', label: 'iHome Manager', name: 'Sungrow iHome Manager', title: 'Sungrow iHomeManager KI-Energiemanager', qty: 1, price: 182, category: 'wallbox', enabled: true,
          url: 'https://1asol.de/products/sungrow-ihomemanager?variant=50514622546198', img: IMG.ihome },
        { id: 'accessories', label: 'Zubehör + Kabel + Stecker', name: 'Schätzung', title: '', qty: 1, price: 490, category: 'mounting', enabled: true, url: '', img: '' }
      ],
      mounting: {
        mode: 'ratio',            // ratio | layout | manual
        refModules: 37,           // Referenz-Modulanzahl aus der Excel
        // Aufsparrendämmung: Otto Lehmann Aufdachmodulhalter ersetzen an diesen Modulen die Dachhaken (1:1).
        // Befestigung an der Konterlatte mit Unischraube 5,0 x 70 mm (separat, Karton 200 Stk., Art.-Nr. 8611001001000).
        // Preise: dachbaustoffe.de, Stand 03.10.2026 (Einzelpreis inkl. MwSt., abhängig von Ziegelmodell/Farbe).
        asd: {
          modules: 0,
          type: '7300',
          holders: {
            '7300': { label: 'Aufdachmodulhalter 7300', name: 'Otto Lehmann Aufdachmodulhalter 7300 mit Metalldachplatte, Stahl, anthrazit (inkl. Verstärkungsschiene 400 mm)', price: 32.58,
                      url: 'https://www.dachbaustoffe.de/shop/artikel/aufdachmodulhalter-otto-lehmann-anthrazit-stahl-7300' },
            '7302': { label: 'Aufdachmodulhalter HVS 7302', name: 'Otto Lehmann Aufdachmodulhalter HVS 7302 (horizontal/vertikal/seitlich) mit Metalldachplatte, anthrazit', price: 45.70,
                      url: 'https://www.dachbaustoffe.de/shop/artikel/hvs-aufdachmodulhalter-anthrazit-otto-lehmann-7302' }
          },
          screw: { label: 'Unischrauben 5,0 × 70 mm', name: 'Lehmann Unischraube 5,0 × 70 mm für Konterlatte – Art.-Nr. 8611001001000 (Karton 200 Stk.)', price: 74.82, packSize: 200,
                   url: 'https://www.dachbaustoffe.de/produkt/1773412-OTL-Holzschrauben-fSparrenschiene-5x70mm-fvz' },
          minOrder: 119,           // dachbaustoffe.de: unter 119 € Warenwert Mindermengenzuschlag
          minOrderFee: 23.80,
          manualUrl: 'https://cdn.prod.website-files.com/68a44461c7a4c625016229e6/6902255d5e2ffc20dc0f5756_OL-Ntr-Eba-00039-23796181-DE.pdf'
        },
        items: {
          hooks:      { label: 'Dachhaken', name: 'K2 SingleHook 3S – Schrägdach Dachziegel – 2003215', price: 7.17, ref: 90, manual: 90,
                        url: 'https://solarhandel24.de/products/k2-systems-singlehook-3s-schragdach-dachziegel?variant=49075013288248', img: IMG.hook },
          rails:      { label: 'Montageschienen 4,8 m', name: 'K2 SingleRail 36 – 4,80 m Aluprofil – 2004393', price: 27.51, ref: 22, manual: 22,
                        url: 'https://solarhandel24.de/products/singlerail-k2-4-80m-aluprofil?variant=47977829794104', img: IMG.rail },
          midClamps:  { label: 'Mittelklemmen', name: 'K2 Mittelklemme Clamp MC 25–40 mm, schwarz eloxiert', price: 1.83, ref: 50, manual: 50,
                        url: 'https://solarhandel24.de/products/k2-mittelklemme-clamp-mc-25-40-mm-schwarz-eloxiert-2004540', img: IMG.mid },
          endClamps:  { label: 'Endklemmen', name: 'K2 Endklemme Clamp EC 25–40 mm, schwarz eloxiert – 2004545', price: 1.83, ref: 50, manual: 50,
                        url: 'https://solarhandel24.de/products/k2-universal-endklemme?variant=47480668750136', img: IMG.end },
          connectors: { label: 'Schienenverbinder', name: 'K2 Schienenverbinder SingleRail 36 Set', price: 4, ref: 10, manual: 10,
                        url: 'https://solarhandel24.de/products/k2-schienenverbinder-singlerail-36-50-2003605', img: IMG.conn }
        },
        layout: {
          rowMode: 'auto',        // auto | custom
          rows: 6,
          customRows: [7, 6, 6, 6, 6, 6],
          orientation: 'portrait',
          gapMm: 20,
          overhangMm: 100,
          railLengthMm: 4800,
          railsPerRow: 2,
          hookSpacingMm: 1200,
          hookEdgeMm: 300,
          reservePct: 5,
          reuseOffcuts: false
        }
      },
      externals: [
        { id: 'scaffold', kind: 'item', label: 'Montage Gerüst', name: '', qty: 1, price: 490, category: 'labor', enabled: true },
        { id: 'montage', kind: 'montage', label: 'Montage', enabled: true, category: 'labor',
          rate: 170, minimum: 1470, billingWp: 470, useModuleWp: false },
        { id: 'connection', kind: 'item', label: 'Anschluss', name: 'Elektroinstallation',
          desc: '– Neuer Zählerschrank (wahrscheinlich im Keller)\n– Komplette Verkabelung und Anschluss der Anlage\n– Anmeldung beim Netzbetreiber/MaStR\n– Inbetriebnahme',
          qty: 1, price: 5000, category: 'electrical', enabled: true }
      ],
      economy: { enabled: true, specificYield: 1007, priceCt: 35, selfMode: 'kwh', selfKwh: 6930, selfPct: 40, feedCt: 7.3 }, // Eigenverbrauch in kWh/Jahr oder % (6.930 kWh = 40 % von 17.325 kWh)
      settings: {
        theme: 'dark',
        sliderMax: 100,
        moduleShop: { domain: 'solarhandel24.de', collections: ['solarmodule', 'glas-glas-solarmodule', 'bifaziale-module'] },
        shipTable: JSON.parse(JSON.stringify(SHIP_TABLE)),
        shops: [
          { domain: '1asol.de', collection: 'solar-wechselrichter', enabled: true },
          { domain: 'solarhandel24.de', collection: 'wechselrichter', enabled: true }
        ]
      },
      library: { inverters: JSON.parse(JSON.stringify(INVERTERS)) },
      moduleCatalog: { source: 'solarhandel24.de', fetchedAt: '2026-10-03T11:40:00+02:00', items: JSON.parse(JSON.stringify(MODULE_CATALOG)) }
    };
  }

  window.SP_DEFAULTS = { create: create };
})();
