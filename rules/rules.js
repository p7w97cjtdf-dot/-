// 由 tools/build-rules.js 依 rules/source/ 的填報手冊產生，請勿手動修改。
// fields：承保 (L)、給付 (D) 欄位定義；rules：手冊檢核規則 (source.page 為 PDF 頁碼，label 為頁面上印的頁碼)；
// toolRules：本工具補充的主檔、對帳、財報、合理性規則。
(function (root, data) {
  if (typeof module === 'object' && module.exports) module.exports = data;
  else { root.DQ = root.DQ || {}; root.DQ.ruleSource = data; }
})(typeof self !== 'undefined' ? self : this, {
 "generatedBy": "tools/build-rules.js",
 "docs": {
  "rules": "新式個人壽險填報說明手冊範例&檢核規則 (2025)",
  "manual": "附件二 人壽保險業個人壽險填報手冊 (2025 填報年度)"
 },
 "fields": {
  "L": {
   "title": "承保資料檔",
   "recordLength": 425,
   "fileName": "LFL公司代號_填報年度.txt",
   "page": {
    "doc": "manual",
    "page": 7,
    "label": "5"
   },
   "fields": [
    {
     "no": 1,
     "key": "company",
     "name": "公司代號",
     "start": 1,
     "end": 2,
     "len": 2,
     "format": "9(02)",
     "type": "數字",
     "codeTable": "表 3．1．1 公司代號表",
     "codes": [
      "11",
      "16",
      "17",
      "18",
      "20",
      "21",
      "22",
      "55",
      "56",
      "57",
      "61",
      "64",
      "67",
      "01",
      "02",
      "03",
      "04",
      "05",
      "06",
      "08",
      "09"
     ],
     "table": "company",
     "typeRule": "10400_L0101",
     "codeRule": "20100_L0102",
     "page": {
      "doc": "manual",
      "page": 9,
      "label": "7"
     }
    },
    {
     "no": 2,
     "key": "policyNo",
     "name": "保單編號",
     "start": 3,
     "end": 17,
     "len": 15,
     "format": "X(15)",
     "type": "文數字",
     "typeRule": "10400_L0201",
     "page": {
      "doc": "manual",
      "page": 10,
      "label": "8"
     }
    },
    {
     "no": 3,
     "key": "policySeq",
     "name": "保單編號序號",
     "start": 18,
     "end": 22,
     "len": 5,
     "format": "X(05)",
     "type": "文數字",
     "typeRule": "10400_L0202",
     "page": {
      "doc": "manual",
      "page": 10,
      "label": "8"
     }
    },
    {
     "no": 4,
     "key": "txnSeq",
     "name": "異動序號",
     "start": 23,
     "end": 27,
     "len": 5,
     "format": "9(05)",
     "type": "數字",
     "typeRule": "10400_L0301",
     "page": {
      "doc": "manual",
      "page": 11,
      "label": "9"
     }
    },
    {
     "no": 5,
     "key": "idType",
     "name": "證件種類",
     "start": 28,
     "end": 28,
     "len": 1,
     "format": "X(01)",
     "type": "文數字",
     "codeTable": "表 3．1．5 證件類別代號表",
     "codes": [
      "0",
      "1",
      "2",
      "3",
      "9"
     ],
     "table": "idType",
     "typeRule": "10400_L0411",
     "codeRule": "22900_L0411",
     "page": {
      "doc": "manual",
      "page": 12,
      "label": "10"
     }
    },
    {
     "no": 6,
     "key": "idNo",
     "name": "證件編號",
     "start": 29,
     "end": 38,
     "len": 10,
     "format": "X(10)",
     "type": "文數字",
     "typeRule": "10400_L0421",
     "page": {
      "doc": "manual",
      "page": 12,
      "label": "10"
     }
    },
    {
     "no": 7,
     "key": "sumInsuredOrig",
     "name": "保險金額(原幣金額)",
     "start": 39,
     "end": 56,
     "len": 18,
     "format": "9(18)",
     "type": "數字",
     "typeRule": "10400_L0501",
     "page": {
      "doc": "manual",
      "page": 12,
      "label": "10"
     }
    },
    {
     "no": 8,
     "key": "termType",
     "name": "保險期間別",
     "start": 57,
     "end": 57,
     "len": 1,
     "format": "X(01)",
     "type": "文數字",
     "codeTable": "表 3．1．8 保險期間別代號表",
     "codes": [
      "B",
      "G",
      "T",
      "W",
      "Y"
     ],
     "table": "termType",
     "typeRule": "10400_L0611",
     "codeRule": "20200_L0612",
     "page": {
      "doc": "manual",
      "page": 12,
      "label": "10"
     }
    },
    {
     "no": 9,
     "key": "term",
     "name": "保險期間",
     "start": 58,
     "end": 60,
     "len": 3,
     "format": "9(03)",
     "type": "數字",
     "typeRule": "10400_L0711",
     "page": {
      "doc": "manual",
      "page": 10,
      "label": "8"
     }
    },
    {
     "no": 10,
     "key": "birthDate",
     "name": "出生日期",
     "start": 61,
     "end": 68,
     "len": 8,
     "format": "9(08)",
     "type": "數字",
     "typeRule": "10400_L0811",
     "page": {
      "doc": "manual",
      "page": 10,
      "label": "8"
     }
    },
    {
     "no": 11,
     "key": "sex",
     "name": "性別",
     "start": 69,
     "end": 69,
     "len": 1,
     "format": "9(01)",
     "type": "數字",
     "codeTable": "性別代號(男 1/女 2)",
     "codes": [
      "1",
      "2"
     ],
     "table": "sex",
     "typeRule": "10400_L0911",
     "codeRule": "20300_L0902",
     "page": {
      "doc": "manual",
      "page": 10,
      "label": "8"
     }
    },
    {
     "no": 12,
     "key": "medExam",
     "name": "有無體檢",
     "start": 70,
     "end": 70,
     "len": 1,
     "format": "9(01)",
     "type": "數字",
     "codeTable": "表 3．1．12 有無體檢代號表",
     "codes": [
      "1",
      "2"
     ],
     "table": "sex",
     "typeRule": "10400_L1011",
     "codeRule": "20400_L1012",
     "page": {
      "doc": "manual",
      "page": 13,
      "label": "11"
     }
    },
    {
     "no": 13,
     "key": "examClass",
     "name": "體檢類別",
     "start": 71,
     "end": 71,
     "len": 1,
     "format": "9(01)",
     "type": "數字",
     "codeTable": "表 3．1．13 體檢類別代號表",
     "codes": [
      "1",
      "2",
      "3"
     ],
     "table": "examClass",
     "typeRule": "10400_L1121",
     "codeRule": "20500_L1122",
     "page": {
      "doc": "manual",
      "page": 13,
      "label": "11"
     }
    },
    {
     "no": 14,
     "key": "substdReason",
     "name": "次標準體原因",
     "start": 72,
     "end": 72,
     "len": 1,
     "format": "9(01)",
     "type": "數字",
     "codeTable": "表 3．1．14 次標準體原因代號表",
     "codes": [
      "0",
      "1",
      "2",
      "8",
      "9"
     ],
     "table": "substd",
     "typeRule": "10400_L1231",
     "codeRule": "20600_L1232",
     "page": {
      "doc": "manual",
      "page": 13,
      "label": "11"
     }
    },
    {
     "no": 15,
     "key": "addType",
     "name": "加保別",
     "start": 73,
     "end": 75,
     "len": 3,
     "format": "X(03)",
     "type": "文數字",
     "codeTable": "表 3．1．15 加保別代號表",
     "codes": [
      "NEW",
      "NCT",
      "CTC",
      "INN",
      "DNN",
      "RNN",
      "XED",
      "XDD",
      "XAB",
      "PAU",
      "ROL",
      "INV",
      "HCC",
      "TPD",
      "EOY",
      "SIB",
      "HLM",
      "MAB",
      "INS"
     ],
     "table": "addType",
     "typeRule": "10400_L1301",
     "codeRule": "20700_L1302",
     "page": {
      "doc": "manual",
      "page": 11,
      "label": "9"
     }
    },
    {
     "no": 16,
     "key": "addDate",
     "name": "加保日期",
     "start": 76,
     "end": 83,
     "len": 8,
     "format": "9(08)",
     "type": "數字",
     "typeRule": "10400_L1401",
     "page": {
      "doc": "manual",
      "page": 11,
      "label": "9"
     }
    },
    {
     "no": 17,
     "key": "exitType",
     "name": "退保別",
     "start": 84,
     "end": 86,
     "len": 3,
     "format": "X(03)",
     "type": "文數字",
     "codeTable": "表 3．1．17 退保別代號表",
     "codes": [
      "XED",
      "CTC",
      "INN",
      "DNN",
      "LNN",
      "DEA",
      "ADS",
      "TDI",
      "ATS",
      "MAD",
      "SRD",
      "SRE",
      "RES",
      "LOP",
      "TMD",
      "PAU",
      "ROL",
      "DDA",
      "XDD",
      "ABD",
      "XAB",
      "INV",
      "HCC",
      "TPD",
      "EOY",
      "SIB",
      "HLM",
      "MAB",
      "INS"
     ],
     "table": "exitType",
     "typeRule": "10400_L1501",
     "codeRule": "20800_L1501",
     "page": {
      "doc": "manual",
      "page": 11,
      "label": "9"
     }
    },
    {
     "no": 18,
     "key": "exitDate",
     "name": "退保日期",
     "start": 87,
     "end": 94,
     "len": 8,
     "format": "9(08)",
     "type": "數字",
     "typeRule": "10400_L1601",
     "page": {
      "doc": "manual",
      "page": 11,
      "label": "9"
     }
    },
    {
     "no": 19,
     "key": "dividendClass",
     "name": "保單分紅類別",
     "start": 95,
     "end": 95,
     "len": 1,
     "format": "X(01)",
     "type": "文數字",
     "codeTable": "表 3．1．19 保單分紅類別表",
     "codes": [
      "S",
      "T",
      "A",
      "B",
      "M",
      "N",
      "Y",
      "X",
      "C",
      "D",
      "P",
      "Q"
     ],
     "table": "dividend",
     "typeRule": "10400_L1701",
     "codeRule": "20900_L1702",
     "page": {
      "doc": "manual",
      "page": 16,
      "label": "14"
     }
    },
    {
     "no": 20,
     "key": "productClass",
     "name": "保險商品類別編號",
     "start": 96,
     "end": 108,
     "len": 13,
     "format": "X(13)",
     "type": "文數字",
     "typeRule": "10400_L1801",
     "page": {
      "doc": "manual",
      "page": 16,
      "label": "14"
     }
    },
    {
     "no": 21,
     "key": "startDate",
     "name": "保險期間起日",
     "start": 109,
     "end": 116,
     "len": 8,
     "format": "9(08)",
     "type": "數字",
     "typeRule": "10400_L1901",
     "page": {
      "doc": "manual",
      "page": 10,
      "label": "8"
     }
    },
    {
     "no": 22,
     "key": "endDate",
     "name": "保險期間迄日",
     "start": 117,
     "end": 124,
     "len": 8,
     "format": "9(08)",
     "type": "數字",
     "typeRule": "10400_L2001",
     "page": {
      "doc": "manual",
      "page": 17,
      "label": "15"
     }
    },
    {
     "no": 23,
     "key": "survivalType",
     "name": "還本型態",
     "start": 125,
     "end": 125,
     "len": 1,
     "format": "9(01)",
     "type": "數字",
     "codeTable": "表 3．1．23 還本型態代號表",
     "codes": [
      "0",
      "1",
      "2",
      "3"
     ],
     "table": "survivalType",
     "typeRule": "10400_L2101",
     "codeRule": "21100_L2102",
     "page": {
      "doc": "manual",
      "page": 17,
      "label": "15"
     }
    },
    {
     "no": 24,
     "key": "benefitType",
     "name": "保單給付型態",
     "start": 126,
     "end": 126,
     "len": 1,
     "format": "9(01)",
     "type": "數字",
     "typeRule": "10400_L2201",
     "page": {
      "doc": "manual",
      "page": 17,
      "label": "15"
     }
    },
    {
     "no": 25,
     "key": "longevityAge",
     "name": "祝壽保險金給付年齡",
     "start": 127,
     "end": 129,
     "len": 3,
     "format": "9(03)",
     "type": "數字",
     "typeRule": "10400_L2301",
     "page": {
      "doc": "manual",
      "page": 17,
      "label": "15"
     }
    },
    {
     "no": 26,
     "key": "screening",
     "name": "有篩選被保險人性質的保單",
     "start": 130,
     "end": 130,
     "len": 1,
     "format": "9(01)",
     "type": "數字",
     "typeRule": "10400_L2401",
     "page": {
      "doc": "manual",
      "page": 18,
      "label": "16"
     }
    },
    {
     "no": 27,
     "key": "smoker",
     "name": "吸煙及非吸煙",
     "start": 131,
     "end": 131,
     "len": 1,
     "format": "9(01)",
     "type": "數字",
     "codeTable": "表 3．1．27 吸煙及非吸煙代號表",
     "codes": [
      "0",
      "1",
      "2"
     ],
     "table": "smoker",
     "typeRule": "10400_L2501",
     "codeRule": "21200_L2502",
     "page": {
      "doc": "manual",
      "page": 18,
      "label": "16"
     }
    },
    {
     "no": 28,
     "key": "disabilityCat",
     "name": "身心障礙類別",
     "start": 132,
     "end": 134,
     "len": 3,
     "format": "X(03)",
     "type": "文數字",
     "codeTable": "表 3．1．28 身心障礙類別代號表",
     "codes": [],
     "typeRule": "10400_L2601",
     "codeRule": "21300_L2601",
     "page": {
      "doc": "manual",
      "page": 14,
      "label": "12"
     }
    },
    {
     "no": 29,
     "key": "disabilityLevel",
     "name": "身心障礙等級",
     "start": 135,
     "end": 135,
     "len": 1,
     "format": "9(01)",
     "type": "數字",
     "codeTable": "表 3．1．29 身心障礙等級代號表",
     "codes": [
      "0",
      "1",
      "2",
      "3",
      "4"
     ],
     "table": "disabilityLevel",
     "typeRule": "10400_L2701",
     "codeRule": "21400_L2702",
     "page": {
      "doc": "manual",
      "page": 14,
      "label": "12"
     }
    },
    {
     "no": 30,
     "key": "econStatus",
     "name": "經濟弱勢者身分",
     "start": 136,
     "end": 136,
     "len": 1,
     "format": "X(01)",
     "type": "文數字",
     "codeTable": "表 3．1．30 經濟弱勢者身分代號表",
     "codes": [
      "0",
      "A",
      "B",
      "C",
      "D",
      "E",
      "F",
      "G",
      "H",
      "I",
      "J",
      "K",
      "M",
      "N",
      "O",
      "P",
      "Q",
      "R",
      "S",
      "T",
      "U",
      "V",
      "W",
      "Z"
     ],
     "table": "econ",
     "typeRule": "10400_L2801",
     "codeRule": "22700_L2802",
     "page": {
      "doc": "manual",
      "page": 22,
      "label": "20"
     }
    },
    {
     "no": 31,
     "key": "groupLink",
     "name": "集體投保之連結關係",
     "start": 137,
     "end": 137,
     "len": 1,
     "format": "X(01)",
     "type": "文數字",
     "codeTable": "表 3．1．31 集體投保之連結關係代號表",
     "codes": [
      "0",
      "A",
      "B",
      "C",
      "D",
      "E",
      "F",
      "G",
      "Z"
     ],
     "table": "groupLink",
     "typeRule": "10400_L2901",
     "codeRule": "22800_L2902",
     "page": {
      "doc": "manual",
      "page": 26,
      "label": "24"
     }
    },
    {
     "no": 32,
     "key": "channel",
     "name": "通路別",
     "start": 138,
     "end": 138,
     "len": 1,
     "format": "9(01)",
     "type": "數字",
     "codeTable": "表 3．1．32 通路別代號表",
     "codes": [
      "1",
      "2",
      "3",
      "4",
      "5"
     ],
     "table": "channel",
     "typeRule": "10400_L3001",
     "codeRule": "21500_L3002",
     "page": {
      "doc": "manual",
      "page": 26,
      "label": "24"
     }
    },
    {
     "no": 33,
     "key": "salesMethod",
     "name": "招攬方式",
     "start": 139,
     "end": 139,
     "len": 1,
     "format": "9(01)",
     "type": "數字",
     "codeTable": "表 3．1．33 招攬方式代號表",
     "codes": [
      "1",
      "2",
      "3",
      "4",
      "5",
      "6",
      "7",
      "9"
     ],
     "table": "salesMethod",
     "typeRule": "10400_L3101",
     "codeRule": "21600_L3102",
     "page": {
      "doc": "manual",
      "page": 26,
      "label": "24"
     }
    },
    {
     "no": 34,
     "key": "insuredRelation",
     "name": "被保險人身份",
     "start": 140,
     "end": 140,
     "len": 1,
     "format": "9(01)",
     "type": "數字",
     "codeTable": "表 3．1．34 被保險人身份代號表",
     "codes": [
      "1",
      "2",
      "3",
      "4",
      "9"
     ],
     "table": "relation",
     "typeRule": "10400_L3201",
     "codeRule": "21700_L3202",
     "page": {
      "doc": "manual",
      "page": 27,
      "label": "25"
     }
    },
    {
     "no": 35,
     "key": "currency",
     "name": "原幣別",
     "start": 141,
     "end": 143,
     "len": 3,
     "format": "X(03)",
     "type": "文數字",
     "codeTable": "表 3．1．35 幣別代號表",
     "codes": [
      "AUD",
      "CAD",
      "CHF",
      "CNY",
      "DKK",
      "EUR",
      "GBP",
      "HKD",
      "IDR",
      "JPY",
      "KRW",
      "MYR",
      "NTD",
      "NZD",
      "PHP",
      "SEK",
      "SGD",
      "THB",
      "USD",
      "ZAR"
     ],
     "table": "currency",
     "typeRule": "10400_L3301",
     "codeRule": "21800_L3302",
     "page": {
      "doc": "manual",
      "page": 27,
      "label": "25"
     }
    },
    {
     "no": 36,
     "key": "illnessDeathOrig",
     "name": "疾病身故保險金(原幣金額)",
     "start": 144,
     "end": 161,
     "len": 18,
     "format": "9(18)",
     "type": "數字",
     "typeRule": "10400_L3401",
     "page": {
      "doc": "manual",
      "page": 27,
      "label": "25"
     }
    },
    {
     "no": 37,
     "key": "occClass",
     "name": "職業類別",
     "start": 162,
     "end": 162,
     "len": 1,
     "format": "9(01)",
     "type": "數字",
     "codeTable": "表 3．1．37 職業類別代號表",
     "codes": [
      "0",
      "1",
      "2",
      "3",
      "4",
      "5",
      "6",
      "8",
      "9"
     ],
     "table": "occClass",
     "typeRule": "10400_L3501",
     "codeRule": "22500_L3502",
     "page": {
      "doc": "manual",
      "page": 14,
      "label": "12"
     }
    },
    {
     "no": 38,
     "key": "productCode",
     "name": "保險商品編號",
     "start": 163,
     "end": 177,
     "len": 15,
     "format": "X(15)",
     "type": "文數字",
     "typeRule": "10400_L3601",
     "page": {
      "doc": "manual",
      "page": 10,
      "label": "8"
     }
    },
    {
     "no": 39,
     "key": "companyPlanCode",
     "name": "公司保單險種代號",
     "start": 178,
     "end": 197,
     "len": 20,
     "format": "X(20)",
     "type": "文數字",
     "typeRule": "10400_L3701",
     "page": {
      "doc": "manual",
      "page": 28,
      "label": "26"
     }
    },
    {
     "no": 40,
     "key": "productCodeVer",
     "name": "保險商品編號適用版本代號",
     "start": 198,
     "end": 198,
     "len": 1,
     "format": "X(01)",
     "type": "文數字",
     "codeTable": "表 3．1．40 保險商品編號適用版本代號表",
     "codes": [
      "1",
      "2"
     ],
     "table": "sex",
     "typeRule": "10400_L3801",
     "codeRule": "21900_L3802",
     "page": {
      "doc": "manual",
      "page": 28,
      "label": "26"
     }
    },
    {
     "no": 41,
     "key": "productCode2",
     "name": "保險商品編號2",
     "start": 199,
     "end": 210,
     "len": 12,
     "format": "X(12)",
     "type": "文數字",
     "typeRule": "10400_L3901",
     "page": {
      "doc": "manual",
      "page": 28,
      "label": "26"
     }
    },
    {
     "no": 42,
     "key": "payFreq",
     "name": "繳費期間別",
     "start": 211,
     "end": 211,
     "len": 1,
     "format": "X(01)",
     "type": "文數字",
     "codeTable": "表 3．1．42 繳費期間別代號表",
     "codes": [
      "0",
      "1",
      "2",
      "3",
      "4",
      "5"
     ],
     "table": "payFreq",
     "typeRule": "10400_L4001",
     "codeRule": "22000_L4002",
     "page": {
      "doc": "manual",
      "page": 14,
      "label": "12"
     }
    },
    {
     "no": 43,
     "key": "payTerm",
     "name": "繳費期間",
     "start": 212,
     "end": 214,
     "len": 3,
     "format": "9(03)",
     "type": "數字",
     "typeRule": "10400_L4101",
     "page": {
      "doc": "manual",
      "page": 14,
      "label": "12"
     }
    },
    {
     "no": 44,
     "key": "paidMonths",
     "name": "累計繳費月數",
     "start": 215,
     "end": 217,
     "len": 3,
     "format": "9(03)",
     "type": "數字",
     "typeRule": "10400_L4201",
     "page": {
      "doc": "manual",
      "page": 29,
      "label": "27"
     }
    },
    {
     "no": 45,
     "key": "lapseReason",
     "name": "停(失)效原因",
     "start": 218,
     "end": 218,
     "len": 1,
     "format": "X(01)",
     "type": "文數字",
     "codeTable": "表 3．1．45 停(失)效原因代號表",
     "codes": [
      "B",
      "D",
      "N",
      "P",
      "S",
      "T"
     ],
     "table": "lapse",
     "typeRule": "10400_L4301",
     "codeRule": "22100_L4301",
     "page": {
      "doc": "manual",
      "page": 29,
      "label": "27"
     }
    },
    {
     "no": 46,
     "key": "occCode",
     "name": "職業分類代碼",
     "start": 219,
     "end": 226,
     "len": 8,
     "format": "X(08)",
     "type": "文數字",
     "typeRule": "10400_L4401",
     "page": {
      "doc": "manual",
      "page": 30,
      "label": "28"
     }
    },
    {
     "no": 47,
     "key": "ownerZip",
     "name": "要保人住所郵遞區號",
     "start": 227,
     "end": 229,
     "len": 3,
     "format": "X(03)",
     "type": "文數字",
     "codeTable": "表 3．1．46 郵遞區號前 3 碼一覽表",
     "codes": [],
     "typeRule": "10400_L4501",
     "codeRule": "22200_L4502",
     "page": {
      "doc": "manual",
      "page": 30,
      "label": "28"
     }
    },
    {
     "no": 48,
     "key": "insuredZip",
     "name": "被保險人住所郵遞區號",
     "start": 230,
     "end": 232,
     "len": 3,
     "format": "X(03)",
     "type": "文數字",
     "codeTable": "表 3．1．46 郵遞區號前 3 碼一覽表",
     "codes": [],
     "typeRule": "10400_L4601",
     "codeRule": "22300_L4602",
     "page": {
      "doc": "manual",
      "page": 30,
      "label": "28"
     }
    },
    {
     "no": 49,
     "key": "totalPremOrig",
     "name": "應繳總保費合計(原幣金額)",
     "start": 233,
     "end": 250,
     "len": 18,
     "format": "9(18)",
     "type": "數字",
     "page": {
      "doc": "manual",
      "page": 30,
      "label": "28"
     }
    },
    {
     "no": 50,
     "key": "totalPremTwd",
     "name": "應繳總保費合計(臺幣金額)",
     "start": 251,
     "end": 268,
     "len": 18,
     "format": "9(18)",
     "type": "數字",
     "page": {
      "doc": "manual",
      "page": 30,
      "label": "28"
     }
    },
    {
     "no": 51,
     "key": "survivalAmtOrig",
     "name": "生存還本保險金額(原幣金額)",
     "start": 269,
     "end": 286,
     "len": 18,
     "format": "9(18)",
     "type": "數字",
     "page": {
      "doc": "manual",
      "page": 31,
      "label": "29"
     }
    },
    {
     "no": 52,
     "key": "survivalAmtTwd",
     "name": "生存還本保險金額(臺幣金額)",
     "start": 287,
     "end": 304,
     "len": 18,
     "format": "9(18)",
     "type": "數字",
     "page": {
      "doc": "manual",
      "page": 31,
      "label": "29"
     }
    },
    {
     "no": 53,
     "key": "longevityAmtOrig",
     "name": "祝壽保險金額(原幣金額)",
     "start": 305,
     "end": 322,
     "len": 18,
     "format": "9(18)",
     "type": "數字",
     "page": {
      "doc": "manual",
      "page": 31,
      "label": "29"
     }
    },
    {
     "no": 54,
     "key": "longevityAmtTwd",
     "name": "祝壽保險金額(臺幣金額)",
     "start": 323,
     "end": 340,
     "len": 18,
     "format": "9(18)",
     "type": "數字",
     "page": {
      "doc": "manual",
      "page": 31,
      "label": "29"
     }
    },
    {
     "no": 55,
     "key": "maturityAmtOrig",
     "name": "滿期保險金額(原幣金額)",
     "start": 341,
     "end": 358,
     "len": 18,
     "format": "9(18)",
     "type": "數字",
     "page": {
      "doc": "manual",
      "page": 31,
      "label": "29"
     }
    },
    {
     "no": 56,
     "key": "maturityAmtTwd",
     "name": "滿期保險金額(臺幣金額)",
     "start": 359,
     "end": 376,
     "len": 18,
     "format": "9(18)",
     "type": "數字",
     "page": {
      "doc": "manual",
      "page": 31,
      "label": "29"
     }
    },
    {
     "no": 57,
     "key": "survivalCond",
     "name": "生存還本金給付條件",
     "start": 377,
     "end": 377,
     "len": 1,
     "format": "9(01)",
     "type": "數字",
     "codeTable": "表 3．1．54 生存還本金給付條件代號表",
     "codes": [
      "0",
      "1",
      "2",
      "3"
     ],
     "table": "survivalType",
     "page": {
      "doc": "manual",
      "page": 32,
      "label": "30"
     }
    },
    {
     "no": 58,
     "key": "survivalFirstDate",
     "name": "生存還本金初次給付日期",
     "start": 378,
     "end": 385,
     "len": 8,
     "format": "9(08)",
     "type": "數字",
     "page": {
      "doc": "manual",
      "page": 32,
      "label": "30"
     }
    },
    {
     "no": 59,
     "key": "sumInsuredTwd",
     "name": "保險金額(臺幣金額)",
     "start": 386,
     "end": 403,
     "len": 18,
     "format": "9(18)",
     "type": "數字",
     "page": {
      "doc": "manual",
      "page": 31,
      "label": "29"
     }
    },
    {
     "no": 60,
     "key": "illnessDeathTwd",
     "name": "疾病身故保險金(臺幣金額)",
     "start": 404,
     "end": 421,
     "len": 18,
     "format": "9(18)",
     "type": "數字",
     "page": {
      "doc": "manual",
      "page": 32,
      "label": "30"
     }
    },
    {
     "no": 61,
     "key": "reserved",
     "name": "保留欄位",
     "start": 422,
     "end": 425,
     "len": 4,
     "format": "X(04)",
     "type": "文數字",
     "page": {
      "doc": "manual",
      "page": 32,
      "label": "30"
     }
    }
   ]
  },
  "D": {
   "title": "給付資料檔",
   "recordLength": 225,
   "fileName": "LFD公司代號_填報年度.txt",
   "page": {
    "doc": "manual",
    "page": 33,
    "label": "31"
   },
   "fields": [
    {
     "no": 1,
     "key": "claimType",
     "name": "給付類別",
     "start": 1,
     "end": 1,
     "len": 1,
     "format": "9(01)",
     "type": "數字",
     "codeTable": "表 3．2．1 給付類別代號表",
     "codes": [
      "1",
      "2",
      "3",
      "4",
      "5",
      "6"
     ],
     "table": "claimType",
     "typeRule": "10400_D0101",
     "codeRule": "23000_D0102",
     "page": {
      "doc": "manual",
      "page": 33,
      "label": "31"
     }
    },
    {
     "no": 2,
     "key": "company",
     "name": "公司代號",
     "start": 2,
     "end": 3,
     "len": 2,
     "format": "9(02)",
     "type": "數字",
     "codeTable": "表 3．1．1 公司代號表",
     "codes": [
      "11",
      "16",
      "17",
      "18",
      "20",
      "21",
      "22",
      "55",
      "56",
      "57",
      "61",
      "64",
      "67",
      "01",
      "02",
      "03",
      "04",
      "05",
      "06",
      "08",
      "09"
     ],
     "table": "company",
     "typeRule": "10400_D0201",
     "codeRule": "D0202",
     "page": {
      "doc": "manual",
      "page": 33,
      "label": "31"
     }
    },
    {
     "no": 3,
     "key": "policyNo",
     "name": "保單編號",
     "start": 4,
     "end": 18,
     "len": 15,
     "format": "X(15)",
     "type": "文數字",
     "typeRule": "10400_D0301",
     "page": {
      "doc": "manual",
      "page": 33,
      "label": "31"
     }
    },
    {
     "no": 4,
     "key": "policySeq",
     "name": "保單編號序號",
     "start": 19,
     "end": 23,
     "len": 5,
     "format": "X(05)",
     "type": "文數字",
     "typeRule": "10400_D0321",
     "page": {
      "doc": "manual",
      "page": 33,
      "label": "31"
     }
    },
    {
     "no": 5,
     "key": "idType",
     "name": "證件種類",
     "start": 24,
     "end": 24,
     "len": 1,
     "format": "X(01)",
     "type": "文數字",
     "codeTable": "證件類別代號表",
     "codes": [
      "0",
      "1",
      "2",
      "3",
      "9"
     ],
     "table": "idType",
     "typeRule": "10400_D0411",
     "codeRule": "D0412",
     "page": {
      "doc": "manual",
      "page": 33,
      "label": "31"
     }
    },
    {
     "no": 6,
     "key": "idNo",
     "name": "證件編號",
     "start": 25,
     "end": 34,
     "len": 10,
     "format": "X(10)",
     "type": "文數字",
     "typeRule": "10400_D0421",
     "page": {
      "doc": "manual",
      "page": 33,
      "label": "31"
     }
    },
    {
     "no": 7,
     "key": "termType",
     "name": "保險期間別",
     "start": 35,
     "end": 35,
     "len": 1,
     "format": "X(01)",
     "type": "文數字",
     "codeTable": "表 3．1．8 保險期間別代號表",
     "codes": [
      "B",
      "G",
      "T",
      "W",
      "Y"
     ],
     "table": "termType",
     "typeRule": "10400_D0511",
     "codeRule": "D0512",
     "page": {
      "doc": "manual",
      "page": 33,
      "label": "31"
     }
    },
    {
     "no": 8,
     "key": "term",
     "name": "保險期間",
     "start": 36,
     "end": 38,
     "len": 3,
     "format": "9(03)",
     "type": "數字",
     "typeRule": "10400_D0521",
     "page": {
      "doc": "manual",
      "page": 33,
      "label": "31"
     }
    },
    {
     "no": 9,
     "key": "birthDate",
     "name": "出生日期",
     "start": 39,
     "end": 46,
     "len": 8,
     "format": "9(08)",
     "type": "數字",
     "typeRule": "10400_D0601",
     "page": {
      "doc": "manual",
      "page": 33,
      "label": "31"
     }
    },
    {
     "no": 10,
     "key": "sex",
     "name": "性別",
     "start": 47,
     "end": 47,
     "len": 1,
     "format": "9(01)",
     "type": "數字",
     "codeTable": "性別代號",
     "codes": [
      "1",
      "2"
     ],
     "table": "sex",
     "typeRule": "10400_D0701",
     "codeRule": "D0702",
     "page": {
      "doc": "manual",
      "page": 33,
      "label": "31"
     }
    },
    {
     "no": 11,
     "key": "medExam",
     "name": "有無體檢",
     "start": 48,
     "end": 48,
     "len": 1,
     "format": "9(01)",
     "type": "數字",
     "codeTable": "有無體檢代號表",
     "codes": [
      "1",
      "2"
     ],
     "table": "sex",
     "typeRule": "10400_D0811",
     "codeRule": "D0812",
     "page": {
      "doc": "manual",
      "page": 33,
      "label": "31"
     }
    },
    {
     "no": 12,
     "key": "examClass",
     "name": "體檢類別",
     "start": 49,
     "end": 49,
     "len": 1,
     "format": "9(01)",
     "type": "數字",
     "codeTable": "體檢類別代號表",
     "codes": [
      "1",
      "2",
      "3"
     ],
     "table": "examClass",
     "typeRule": "10400_D0821",
     "codeRule": "D0822",
     "page": {
      "doc": "manual",
      "page": 33,
      "label": "31"
     }
    },
    {
     "no": 13,
     "key": "substdReason",
     "name": "次標準體原因",
     "start": 50,
     "end": 50,
     "len": 1,
     "format": "9(01)",
     "type": "數字",
     "codeTable": "次標準體原因代號表",
     "codes": [
      "0",
      "1",
      "2",
      "8",
      "9"
     ],
     "table": "substd",
     "typeRule": "10400_D0831",
     "codeRule": "D0832",
     "page": {
      "doc": "manual",
      "page": 33,
      "label": "31"
     }
    },
    {
     "no": 14,
     "key": "startDate",
     "name": "保險期間起日",
     "start": 51,
     "end": 58,
     "len": 8,
     "format": "9(08)",
     "type": "數字",
     "typeRule": "10400_D0901",
     "page": {
      "doc": "manual",
      "page": 33,
      "label": "31"
     }
    },
    {
     "no": 15,
     "key": "eventDate",
     "name": "發生日期",
     "start": 59,
     "end": 66,
     "len": 8,
     "format": "9(08)",
     "type": "數字",
     "typeRule": "10400_D1001",
     "page": {
      "doc": "manual",
      "page": 33,
      "label": "31"
     }
    },
    {
     "no": 16,
     "key": "dueAmtOrig",
     "name": "應給付金額(原幣金額)",
     "start": 67,
     "end": 84,
     "len": 18,
     "format": "9(18)",
     "type": "數字",
     "typeRule": "10400_D1101",
     "page": {
      "doc": "manual",
      "page": 33,
      "label": "31"
     }
    },
    {
     "no": 17,
     "key": "paidAmtOrig",
     "name": "實際給付金額(原幣金額)",
     "start": 85,
     "end": 102,
     "len": 18,
     "format": "9(18)",
     "type": "數字",
     "typeRule": "10400_D1201",
     "page": {
      "doc": "manual",
      "page": 33,
      "label": "31"
     }
    },
    {
     "no": 18,
     "key": "diffReason",
     "name": "應給付與實際給付金額不同原因",
     "start": 103,
     "end": 106,
     "len": 4,
     "format": "X(04)",
     "type": "文數字",
     "typeRule": "10400_D1301",
     "page": {
      "doc": "manual",
      "page": 33,
      "label": "31"
     }
    },
    {
     "no": 19,
     "key": "causeIcd",
     "name": "死亡及完全失能原因(ICD-10-CM)",
     "start": 107,
     "end": 111,
     "len": 5,
     "format": "X(05)",
     "type": "文數字",
     "typeRule": "10400_D1401",
     "page": {
      "doc": "manual",
      "page": 33,
      "label": "31"
     }
    },
    {
     "no": 20,
     "key": "disabilityItem",
     "name": "完全失能項次等級",
     "start": 112,
     "end": 119,
     "len": 8,
     "format": "X(08)",
     "type": "文數字",
     "typeRule": "10400_D1501",
     "page": {
      "doc": "manual",
      "page": 33,
      "label": "31"
     }
    },
    {
     "no": 21,
     "key": "productClass",
     "name": "保險商品類別編號",
     "start": 120,
     "end": 132,
     "len": 13,
     "format": "X(13)",
     "type": "文數字",
     "typeRule": "10400_D1601",
     "page": {
      "doc": "manual",
      "page": 33,
      "label": "31"
     }
    },
    {
     "no": 22,
     "key": "currency",
     "name": "原幣別",
     "start": 133,
     "end": 135,
     "len": 3,
     "format": "X(03)",
     "type": "文數字",
     "codeTable": "幣別代號表",
     "codes": [
      "AUD",
      "CAD",
      "CHF",
      "CNY",
      "DKK",
      "EUR",
      "GBP",
      "HKD",
      "IDR",
      "JPY",
      "KRW",
      "MYR",
      "NTD",
      "NZD",
      "PHP",
      "SEK",
      "SGD",
      "THB",
      "USD",
      "ZAR"
     ],
     "table": "currency",
     "typeRule": "10400_D1701",
     "codeRule": "D1701",
     "page": {
      "doc": "manual",
      "page": 33,
      "label": "31"
     }
    },
    {
     "no": 23,
     "key": "payDate",
     "name": "給付日期",
     "start": 136,
     "end": 143,
     "len": 8,
     "format": "9(08)",
     "type": "數字",
     "typeRule": "10400_D1801",
     "page": {
      "doc": "manual",
      "page": 33,
      "label": "31"
     }
    },
    {
     "no": 24,
     "key": "occClass",
     "name": "事故時職業類別",
     "start": 144,
     "end": 144,
     "len": 1,
     "format": "X(01)",
     "type": "文數字",
     "codeTable": "職業類別代號表",
     "codes": [
      "0",
      "1",
      "2",
      "3",
      "4",
      "5",
      "6",
      "8",
      "9"
     ],
     "table": "occClass",
     "typeRule": "10400_D1901",
     "codeRule": "D1902",
     "page": {
      "doc": "manual",
      "page": 33,
      "label": "31"
     }
    },
    {
     "no": 25,
     "key": "disabilityCat",
     "name": "身心障礙類別",
     "start": 145,
     "end": 147,
     "len": 3,
     "format": "X(03)",
     "type": "文數字",
     "codeTable": "身心障礙類別代號表",
     "codes": [],
     "typeRule": "10400_D2001",
     "codeRule": "D2002",
     "page": {
      "doc": "manual",
      "page": 33,
      "label": "31"
     }
    },
    {
     "no": 26,
     "key": "disabilityLevel",
     "name": "身心障礙等級",
     "start": 148,
     "end": 148,
     "len": 1,
     "format": "9(01)",
     "type": "數字",
     "codeTable": "身心障礙等級代號表",
     "codes": [
      "0",
      "1",
      "2",
      "3",
      "4"
     ],
     "table": "disabilityLevel",
     "typeRule": "10400_D2101",
     "codeRule": "D2102",
     "page": {
      "doc": "manual",
      "page": 33,
      "label": "31"
     }
    },
    {
     "no": 27,
     "key": "companyPlanCode",
     "name": "公司保單險種代號",
     "start": 149,
     "end": 168,
     "len": 20,
     "format": "X(20)",
     "type": "文數字",
     "typeRule": "10400_D2201",
     "page": {
      "doc": "manual",
      "page": 33,
      "label": "31"
     }
    },
    {
     "no": 28,
     "key": "payMethod",
     "name": "給付方式",
     "start": 169,
     "end": 169,
     "len": 1,
     "format": "X(01)",
     "type": "文數字",
     "codeTable": "表 3．2．28 給付方式代號表",
     "codes": [
      "1",
      "2",
      "3"
     ],
     "table": "examClass",
     "page": {
      "doc": "manual",
      "page": 33,
      "label": "31"
     }
    },
    {
     "no": 29,
     "key": "dueAmtTwd",
     "name": "應給付金額(臺幣金額)",
     "start": 170,
     "end": 187,
     "len": 18,
     "format": "9(18)",
     "type": "數字",
     "page": {
      "doc": "manual",
      "page": 33,
      "label": "31"
     }
    },
    {
     "no": 30,
     "key": "paidAmtTwd",
     "name": "實際給付金額(臺幣金額)",
     "start": 188,
     "end": 205,
     "len": 18,
     "format": "9(18)",
     "type": "數字",
     "page": {
      "doc": "manual",
      "page": 33,
      "label": "31"
     }
    },
    {
     "no": 31,
     "key": "reserved",
     "name": "保留欄位",
     "start": 206,
     "end": 225,
     "len": 20,
     "format": "X(20)",
     "type": "文數字",
     "page": {
      "doc": "manual",
      "page": 33,
      "label": "31"
     }
    }
   ]
  }
 },
 "tables": {
  "company": {
   "11": "三商美邦人壽",
   "16": "遠雄人壽",
   "17": "宏泰人壽",
   "18": "安聯人壽",
   "20": "中華郵政壽險處",
   "21": "第一金人壽",
   "22": "合作金庫人壽",
   "55": "台新人壽",
   "56": "安達國際人壽",
   "57": "友邦人壽",
   "61": "元大人壽",
   "64": "全球人壽",
   "67": "法國巴黎人壽",
   "01": "臺銀人壽",
   "02": "台灣人壽",
   "03": "保誠人壽",
   "04": "國泰人壽",
   "05": "凱基人壽",
   "06": "南山人壽",
   "08": "新光人壽",
   "09": "富邦人壽"
  },
  "idType": [
   "0",
   "1",
   "2",
   "3",
   "9"
  ],
  "termType": {
   "B": "一年期",
   "G": "一年期保證續保",
   "T": "年滿期",
   "W": "歲滿期",
   "Y": "終身"
  },
  "sex": {
   "1": "男",
   "2": "女"
  },
  "medExam": {
   "1": "有體檢",
   "2": "無體檢"
  },
  "examClass": {
   "1": "標準體",
   "2": "次標準體或弱體",
   "3": "優體"
  },
  "substd": {
   "0": "非次標準體",
   "1": "體檢",
   "2": "職業",
   "8": "含 2 項以上原因",
   "9": "其它"
  },
  "addType": {
   "NEW": "新契約",
   "NCT": "契約轉換1",
   "CTC": "契約轉換2",
   "INN": "保額增加",
   "DNN": "保額減少",
   "RNN": "復效",
   "XED": "持續有效(期初)",
   "XDD": "罹患重大疾病未終止",
   "XAB": "生命末期未終止",
   "PAU": "繳清",
   "ROL": "展期",
   "INV": "登記疾病身故保險金",
   "HCC": "危險分類欄位變更",
   "TPD": "繳費期間別變更",
   "EOY": "補充新增欄位資料",
   "SIB": "生存還本金",
   "HLM": "祝壽金",
   "MAB": "滿期金",
   "INS": "登記生存還本保險金"
  },
  "exitType": {
   "XED": "持續有效(期末)",
   "CTC": "契約轉換2",
   "INN": "保額增加",
   "DNN": "保額減少",
   "LNN": "停效",
   "DEA": "疾病死亡",
   "ADS": "意外死亡",
   "TDI": "疾病完全失能",
   "ATS": "意外完全失能",
   "MAD": "滿期",
   "SRD": "解約",
   "SRE": "解除契約",
   "RES": "撤銷",
   "LOP": "失效",
   "TMD": "終止",
   "PAU": "繳清",
   "ROL": "展期",
   "DDA": "罹患重大疾病終止",
   "XDD": "罹患重大疾病未終止",
   "ABD": "生命末期終止",
   "XAB": "生命末期未終止",
   "INV": "登記疾病身故保險金",
   "HCC": "危險分類欄位變更",
   "TPD": "繳費期間別變更",
   "EOY": "期末有效",
   "SIB": "生存還本金",
   "HLM": "祝壽金",
   "MAB": "滿期金",
   "INS": "登記生存還本保險金"
  },
  "dividend": [
   "S",
   "T",
   "A",
   "B",
   "M",
   "N",
   "Y",
   "X",
   "C",
   "D",
   "P",
   "Q"
  ],
  "survivalType": {
   "0": "無還本",
   "1": "定期還本",
   "2": "終身還本",
   "3": "非分期還本"
  },
  "smoker": {
   "0": "無分類",
   "1": "吸煙",
   "2": "非吸煙"
  },
  "disabilityLevel": {
   "0": "非身心障礙",
   "1": "極重度",
   "2": "重度",
   "3": "中度",
   "4": "輕度"
  },
  "econ": [
   "0",
   "A",
   "B",
   "C",
   "D",
   "E",
   "F",
   "G",
   "H",
   "I",
   "J",
   "K",
   "M",
   "N",
   "O",
   "P",
   "Q",
   "R",
   "S",
   "T",
   "U",
   "V",
   "W",
   "Z"
  ],
  "groupLink": [
   "0",
   "A",
   "B",
   "C",
   "D",
   "E",
   "F",
   "G",
   "Z"
  ],
  "channel": {
   "1": "壽險公司",
   "2": "銀行保經",
   "3": "銀行保代",
   "4": "一般保經",
   "5": "一般保代"
  },
  "salesMethod": {
   "1": "保險業務員",
   "2": "郵寄",
   "3": "電話行銷",
   "4": "網路銷售",
   "5": "直接投保",
   "6": "直效行銷",
   "7": "網路投保",
   "9": "其他"
  },
  "relation": {
   "1": "本人",
   "2": "配偶",
   "3": "子女",
   "4": "父母",
   "9": "其他"
  },
  "currency": [
   "AUD",
   "CAD",
   "CHF",
   "CNY",
   "DKK",
   "EUR",
   "GBP",
   "HKD",
   "IDR",
   "JPY",
   "KRW",
   "MYR",
   "NTD",
   "NZD",
   "PHP",
   "SEK",
   "SGD",
   "THB",
   "USD",
   "ZAR"
  ],
  "occClass": [
   "0",
   "1",
   "2",
   "3",
   "4",
   "5",
   "6",
   "8",
   "9"
  ],
  "productVer": {
   "1": "15 碼版本",
   "2": "27 碼版本"
  },
  "payFreq": {
   "0": "躉繳",
   "1": "年繳",
   "2": "半年繳",
   "3": "季繳",
   "4": "月繳",
   "5": "彈性繳"
  },
  "lapse": {
   "B": "同時有保單貸款與墊繳",
   "D": "保單貸款",
   "N": "非停失效之異動",
   "P": "墊繳",
   "S": "不繳費",
   "T": "其他"
  },
  "survivalCond": {
   "0": "無給付",
   "1": "繳費期滿後給付",
   "2": "到達約定年期後給付",
   "3": "到達約定年齡後給付"
  },
  "claimType": {
   "1": "死亡",
   "2": "完全失能",
   "3": "生命末期提前給付",
   "4": "生存還本金",
   "5": "祝壽金",
   "6": "滿期金"
  },
  "diffReason": {
   "0": "相同",
   "1": "削額給付",
   "2": "和解",
   "3": "違反告知義務",
   "4": "條款除外責任",
   "5": "含紅利給付",
   "6": "意外事故",
   "7": "生命表差額增額給付",
   "8": "其他"
  },
  "payMethod": {
   "1": "一次性給付",
   "2": "約定期間且分期給付",
   "3": "終身且分期給付"
  }
 },
 "rules": [
  {
   "id": "F001",
   "name": "檔名命名原則",
   "category": "格式",
   "level": "檔案",
   "severity": "warning",
   "file": "L/D",
   "ref": "參、一、資料總說明",
   "source": {
    "doc": "manual",
    "page": 6,
    "label": "4",
    "note": "參、一、資料總說明：檔案命名原則"
   }
  },
  {
   "id": "F002",
   "name": "檔案為空",
   "category": "格式",
   "level": "檔案",
   "severity": "error",
   "file": "L/D",
   "ref": "貳、二、(三) 文字檔基本檢測",
   "source": {
    "doc": "rules",
    "page": 67,
    "label": "伍-35",
    "note": "肆、代碼表 106「檔案是空的」"
   }
  },
  {
   "id": "F003",
   "name": "不能有空白行",
   "category": "格式",
   "level": "檔案",
   "severity": "error",
   "file": "L/D",
   "ref": "貳、二、(一) 文字檔資料格式 2",
   "source": {
    "doc": "rules",
    "page": 44,
    "label": "貳-12",
    "note": "貳、資料上傳格式：文字檔資料格式"
   }
  },
  {
   "id": "F004",
   "name": "限使用半形英數字",
   "category": "格式",
   "level": "檔案",
   "severity": "error",
   "file": "L/D",
   "ref": "貳、二、(一) 文字檔資料格式 3",
   "source": {
    "doc": "rules",
    "page": 44,
    "label": "貳-12",
    "note": "貳、資料上傳格式：文字檔資料格式"
   }
  },
  {
   "id": "10300",
   "name": "每筆資料長度",
   "category": "格式",
   "level": "檔案",
   "severity": "error",
   "file": "D",
   "ref": "承保檔 425 / 給付檔 225",
   "source": {
    "doc": "rules",
    "page": 67,
    "label": "伍-35",
    "note": "肆、代碼表 101「總長度錯誤」、103「資料型態錯誤」"
   }
  },
  {
   "id": "10400_L0101",
   "name": "公司代號 資料類型",
   "category": "格式",
   "level": "資料類型",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 1",
   "source": {
    "doc": "rules",
    "page": 46,
    "label": "伍-14",
    "program": 79
   }
  },
  {
   "id": "20100_L0102",
   "name": "公司代號 代碼",
   "category": "代碼",
   "level": "代碼",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 1；表 3．1．1 公司代號表",
   "source": {
    "doc": "rules",
    "page": 46,
    "label": "伍-14",
    "program": 79
   }
  },
  {
   "id": "10400_L0201",
   "name": "保單編號 資料類型",
   "category": "格式",
   "level": "資料類型",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 2",
   "source": {
    "doc": "rules",
    "page": 46,
    "label": "伍-14",
    "program": 79
   }
  },
  {
   "id": "10400_L0202",
   "name": "保單編號序號 資料類型",
   "category": "格式",
   "level": "資料類型",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 3",
   "source": {
    "doc": "rules",
    "page": 46,
    "label": "伍-14",
    "program": 79
   }
  },
  {
   "id": "10400_L0301",
   "name": "異動序號 資料類型",
   "category": "格式",
   "level": "資料類型",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 4",
   "source": {
    "doc": "rules",
    "page": 46,
    "label": "伍-14",
    "program": 79
   }
  },
  {
   "id": "10400_L0411",
   "name": "證件種類 資料類型",
   "category": "格式",
   "level": "資料類型",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 5",
   "source": {
    "doc": "rules",
    "page": 47,
    "label": "伍-15",
    "program": 80
   }
  },
  {
   "id": "22900_L0411",
   "name": "證件種類 代碼",
   "category": "代碼",
   "level": "代碼",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 5；表 3．1．5 證件類別代號表",
   "source": {
    "doc": "rules",
    "page": 47,
    "label": "伍-15",
    "program": 80
   }
  },
  {
   "id": "10400_L0421",
   "name": "證件編號 資料類型",
   "category": "格式",
   "level": "資料類型",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 6",
   "source": {
    "doc": "rules",
    "page": 47,
    "label": "伍-15",
    "program": 80
   }
  },
  {
   "id": "10400_L0501",
   "name": "保險金額(原幣金額) 資料類型",
   "category": "格式",
   "level": "資料類型",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 7",
   "source": {
    "doc": "rules",
    "page": 47,
    "label": "伍-15",
    "program": 81
   }
  },
  {
   "id": "10400_L0611",
   "name": "保險期間別 資料類型",
   "category": "格式",
   "level": "資料類型",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 8",
   "source": {
    "doc": "rules",
    "page": 47,
    "label": "伍-15",
    "program": 81
   }
  },
  {
   "id": "20200_L0612",
   "name": "保險期間別 代碼",
   "category": "代碼",
   "level": "代碼",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 8；表 3．1．8 保險期間別代號表",
   "source": {
    "doc": "rules",
    "page": 47,
    "label": "伍-15",
    "program": 81
   }
  },
  {
   "id": "10400_L0711",
   "name": "保險期間 資料類型",
   "category": "格式",
   "level": "資料類型",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 9",
   "source": {
    "doc": "rules",
    "page": 47,
    "label": "伍-15",
    "program": 82
   }
  },
  {
   "id": "10400_L0811",
   "name": "出生日期 資料類型",
   "category": "格式",
   "level": "資料類型",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 10",
   "source": {
    "doc": "rules",
    "page": 47,
    "label": "伍-15",
    "program": 82
   }
  },
  {
   "id": "10400_L0911",
   "name": "性別 資料類型",
   "category": "格式",
   "level": "資料類型",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 11",
   "source": {
    "doc": "rules",
    "page": 48,
    "label": "伍-16",
    "program": 82
   }
  },
  {
   "id": "20300_L0902",
   "name": "性別 代碼",
   "category": "代碼",
   "level": "代碼",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 11；性別代號(男 1/女 2)",
   "source": {
    "doc": "rules",
    "page": 48,
    "label": "伍-16",
    "program": 83
   }
  },
  {
   "id": "10400_L1011",
   "name": "有無體檢 資料類型",
   "category": "格式",
   "level": "資料類型",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 12",
   "source": {
    "doc": "rules",
    "page": 48,
    "label": "伍-16",
    "program": 83
   }
  },
  {
   "id": "20400_L1012",
   "name": "有無體檢 代碼",
   "category": "代碼",
   "level": "代碼",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 12；表 3．1．12 有無體檢代號表",
   "source": {
    "doc": "rules",
    "page": 48,
    "label": "伍-16",
    "program": 83
   }
  },
  {
   "id": "10400_L1121",
   "name": "體檢類別 資料類型",
   "category": "格式",
   "level": "資料類型",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 13",
   "source": {
    "doc": "rules",
    "page": 48,
    "label": "伍-16",
    "program": 83
   }
  },
  {
   "id": "20500_L1122",
   "name": "體檢類別 代碼",
   "category": "代碼",
   "level": "代碼",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 13；表 3．1．13 體檢類別代號表",
   "source": {
    "doc": "rules",
    "page": 48,
    "label": "伍-16",
    "program": 83
   }
  },
  {
   "id": "10400_L1231",
   "name": "次標準體原因 資料類型",
   "category": "格式",
   "level": "資料類型",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 14",
   "source": {
    "doc": "rules",
    "page": 48,
    "label": "伍-16",
    "program": 83
   }
  },
  {
   "id": "20600_L1232",
   "name": "次標準體原因 代碼",
   "category": "代碼",
   "level": "代碼",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 14；表 3．1．14 次標準體原因代號表",
   "source": {
    "doc": "rules",
    "page": 48,
    "label": "伍-16",
    "program": 83
   }
  },
  {
   "id": "10400_L1301",
   "name": "加保別 資料類型",
   "category": "格式",
   "level": "資料類型",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 15",
   "source": {
    "doc": "rules",
    "page": 48,
    "label": "伍-16",
    "program": 83
   }
  },
  {
   "id": "20700_L1302",
   "name": "加保別 代碼",
   "category": "代碼",
   "level": "代碼",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 15；表 3．1．15 加保別代號表",
   "source": {
    "doc": "rules",
    "page": 48,
    "label": "伍-16",
    "program": 83
   }
  },
  {
   "id": "10400_L1401",
   "name": "加保日期 資料類型",
   "category": "格式",
   "level": "資料類型",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 16",
   "source": {
    "doc": "rules",
    "page": 49,
    "label": "伍-17",
    "program": 85
   }
  },
  {
   "id": "10400_L1501",
   "name": "退保別 資料類型",
   "category": "格式",
   "level": "資料類型",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 17",
   "source": {
    "doc": "rules",
    "page": 49,
    "label": "伍-17",
    "program": 86
   }
  },
  {
   "id": "20800_L1501",
   "name": "退保別 代碼",
   "category": "代碼",
   "level": "代碼",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 17；表 3．1．17 退保別代號表",
   "source": {
    "doc": "rules",
    "page": 49,
    "label": "伍-17",
    "program": 86
   }
  },
  {
   "id": "10400_L1601",
   "name": "退保日期 資料類型",
   "category": "格式",
   "level": "資料類型",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 18",
   "source": {
    "doc": "rules",
    "page": 49,
    "label": "伍-17",
    "program": 88
   }
  },
  {
   "id": "10400_L1701",
   "name": "保單分紅類別 資料類型",
   "category": "格式",
   "level": "資料類型",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 19",
   "source": {
    "doc": "rules",
    "page": 50,
    "label": "伍-18",
    "program": 89
   }
  },
  {
   "id": "20900_L1702",
   "name": "保單分紅類別 代碼",
   "category": "代碼",
   "level": "代碼",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 19；表 3．1．19 保單分紅類別表",
   "source": {
    "doc": "rules",
    "page": 50,
    "label": "伍-18",
    "program": 89
   }
  },
  {
   "id": "10400_L1801",
   "name": "保險商品類別編號 資料類型",
   "category": "格式",
   "level": "資料類型",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 20",
   "source": {
    "doc": "rules",
    "page": 50,
    "label": "伍-18",
    "program": 90
   }
  },
  {
   "id": "10400_L1901",
   "name": "保險期間起日 資料類型",
   "category": "格式",
   "level": "資料類型",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 21",
   "source": {
    "doc": "rules",
    "page": 51,
    "label": "伍-19",
    "program": 93
   }
  },
  {
   "id": "10400_L2001",
   "name": "保險期間迄日 資料類型",
   "category": "格式",
   "level": "資料類型",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 22",
   "source": {
    "doc": "rules",
    "page": 51,
    "label": "伍-19",
    "program": 94
   }
  },
  {
   "id": "10400_L2101",
   "name": "還本型態 資料類型",
   "category": "格式",
   "level": "資料類型",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 23",
   "source": {
    "doc": "rules",
    "page": 51,
    "label": "伍-19",
    "program": 94
   }
  },
  {
   "id": "21100_L2102",
   "name": "還本型態 代碼",
   "category": "代碼",
   "level": "代碼",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 23；表 3．1．23 還本型態代號表",
   "source": {
    "doc": "rules",
    "page": 51,
    "label": "伍-19",
    "program": 94
   }
  },
  {
   "id": "10400_L2201",
   "name": "保單給付型態 資料類型",
   "category": "格式",
   "level": "資料類型",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 24",
   "source": {
    "doc": "rules",
    "page": 52,
    "label": "伍-20",
    "program": 95
   }
  },
  {
   "id": "10400_L2301",
   "name": "祝壽保險金給付年齡 資料類型",
   "category": "格式",
   "level": "資料類型",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 25",
   "source": {
    "doc": "rules",
    "page": 52,
    "label": "伍-20",
    "program": 96
   }
  },
  {
   "id": "10400_L2401",
   "name": "有篩選被保險人性質的保單 資料類型",
   "category": "格式",
   "level": "資料類型",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 26",
   "source": {
    "doc": "rules",
    "page": 52,
    "label": "伍-20",
    "program": 96
   }
  },
  {
   "id": "10400_L2501",
   "name": "吸煙及非吸煙 資料類型",
   "category": "格式",
   "level": "資料類型",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 27",
   "source": {
    "doc": "rules",
    "page": 52,
    "label": "伍-20",
    "program": 96
   }
  },
  {
   "id": "21200_L2502",
   "name": "吸煙及非吸煙 代碼",
   "category": "代碼",
   "level": "代碼",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 27；表 3．1．27 吸煙及非吸煙代號表",
   "source": {
    "doc": "rules",
    "page": 52,
    "label": "伍-20",
    "program": 96
   }
  },
  {
   "id": "10400_L2601",
   "name": "身心障礙類別 資料類型",
   "category": "格式",
   "level": "資料類型",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 28",
   "source": {
    "doc": "rules",
    "page": 52,
    "label": "伍-20",
    "program": 97
   }
  },
  {
   "id": "21300_L2601",
   "name": "身心障礙類別 代碼",
   "category": "代碼",
   "level": "代碼",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 28；表 3．1．28 身心障礙類別代號表",
   "source": {
    "doc": "rules",
    "page": 52,
    "label": "伍-20",
    "program": 97
   }
  },
  {
   "id": "10400_L2701",
   "name": "身心障礙等級 資料類型",
   "category": "格式",
   "level": "資料類型",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 29",
   "source": {
    "doc": "rules",
    "page": 52,
    "label": "伍-20",
    "program": 97
   }
  },
  {
   "id": "21400_L2702",
   "name": "身心障礙等級 代碼",
   "category": "代碼",
   "level": "代碼",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 29；表 3．1．29 身心障礙等級代號表",
   "source": {
    "doc": "rules",
    "page": 52,
    "label": "伍-20",
    "program": 97
   }
  },
  {
   "id": "10400_L2801",
   "name": "經濟弱勢者身分 資料類型",
   "category": "格式",
   "level": "資料類型",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 30",
   "source": {
    "doc": "rules",
    "page": 52,
    "label": "伍-20",
    "program": 97
   }
  },
  {
   "id": "22700_L2802",
   "name": "經濟弱勢者身分 代碼",
   "category": "代碼",
   "level": "代碼",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 30；表 3．1．30 經濟弱勢者身分代號表",
   "source": {
    "doc": "rules",
    "page": 53,
    "label": "伍-21",
    "program": 97
   }
  },
  {
   "id": "10400_L2901",
   "name": "集體投保之連結關係 資料類型",
   "category": "格式",
   "level": "資料類型",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 31",
   "source": {
    "doc": "rules",
    "page": 53,
    "label": "伍-21",
    "program": 98
   }
  },
  {
   "id": "22800_L2902",
   "name": "集體投保之連結關係 代碼",
   "category": "代碼",
   "level": "代碼",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 31；表 3．1．31 集體投保之連結關係代號表",
   "source": {
    "doc": "rules",
    "page": 53,
    "label": "伍-21",
    "program": 98
   }
  },
  {
   "id": "10400_L3001",
   "name": "通路別 資料類型",
   "category": "格式",
   "level": "資料類型",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 32",
   "source": {
    "doc": "rules",
    "page": 53,
    "label": "伍-21",
    "program": 98
   }
  },
  {
   "id": "21500_L3002",
   "name": "通路別 代碼",
   "category": "代碼",
   "level": "代碼",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 32；表 3．1．32 通路別代號表",
   "source": {
    "doc": "rules",
    "page": 53,
    "label": "伍-21",
    "program": 99
   }
  },
  {
   "id": "10400_L3101",
   "name": "招攬方式 資料類型",
   "category": "格式",
   "level": "資料類型",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 33",
   "source": {
    "doc": "rules",
    "page": 53,
    "label": "伍-21",
    "program": 99
   }
  },
  {
   "id": "21600_L3102",
   "name": "招攬方式 代碼",
   "category": "代碼",
   "level": "代碼",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 33；表 3．1．33 招攬方式代號表",
   "source": {
    "doc": "rules",
    "page": 53,
    "label": "伍-21",
    "program": 99
   }
  },
  {
   "id": "10400_L3201",
   "name": "被保險人身份 資料類型",
   "category": "格式",
   "level": "資料類型",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 34",
   "source": {
    "doc": "rules",
    "page": 53,
    "label": "伍-21",
    "program": 99
   }
  },
  {
   "id": "21700_L3202",
   "name": "被保險人身份 代碼",
   "category": "代碼",
   "level": "代碼",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 34；表 3．1．34 被保險人身份代號表",
   "source": {
    "doc": "rules",
    "page": 53,
    "label": "伍-21",
    "program": 99
   }
  },
  {
   "id": "10400_L3301",
   "name": "原幣別 資料類型",
   "category": "格式",
   "level": "資料類型",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 35",
   "source": {
    "doc": "rules",
    "page": 53,
    "label": "伍-21",
    "program": 99
   }
  },
  {
   "id": "21800_L3302",
   "name": "原幣別 代碼",
   "category": "代碼",
   "level": "代碼",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 35；表 3．1．35 幣別代號表",
   "source": {
    "doc": "rules",
    "page": 53,
    "label": "伍-21",
    "program": 99
   }
  },
  {
   "id": "10400_L3401",
   "name": "疾病身故保險金(原幣金額) 資料類型",
   "category": "格式",
   "level": "資料類型",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 36",
   "source": {
    "doc": "rules",
    "page": 53,
    "label": "伍-21",
    "program": 99
   }
  },
  {
   "id": "10400_L3501",
   "name": "職業類別 資料類型",
   "category": "格式",
   "level": "資料類型",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 37",
   "source": {
    "doc": "rules",
    "page": 54,
    "label": "伍-22",
    "program": 100
   }
  },
  {
   "id": "22500_L3502",
   "name": "職業類別 代碼",
   "category": "代碼",
   "level": "代碼",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 37；表 3．1．37 職業類別代號表",
   "source": {
    "doc": "rules",
    "page": 54,
    "label": "伍-22",
    "program": 100
   }
  },
  {
   "id": "10400_L3601",
   "name": "保險商品編號 資料類型",
   "category": "格式",
   "level": "資料類型",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 38",
   "source": {
    "doc": "rules",
    "page": 54,
    "label": "伍-22",
    "program": 100
   }
  },
  {
   "id": "10400_L3701",
   "name": "公司保單險種代號 資料類型",
   "category": "格式",
   "level": "資料類型",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 39",
   "source": {
    "doc": "rules",
    "page": 54,
    "label": "伍-22",
    "program": 101
   }
  },
  {
   "id": "10400_L3801",
   "name": "保險商品編號適用版本代號 資料類型",
   "category": "格式",
   "level": "資料類型",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 40",
   "source": {
    "doc": "rules",
    "page": 54,
    "label": "伍-22",
    "program": 101
   }
  },
  {
   "id": "21900_L3802",
   "name": "保險商品編號適用版本代號 代碼",
   "category": "代碼",
   "level": "代碼",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 40；表 3．1．40 保險商品編號適用版本代號表",
   "source": {
    "doc": "rules",
    "page": 54,
    "label": "伍-22",
    "program": 101
   }
  },
  {
   "id": "10400_L3901",
   "name": "保險商品編號2 資料類型",
   "category": "格式",
   "level": "資料類型",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 41",
   "source": {
    "doc": "rules",
    "page": 102,
    "label": "伍-70"
   }
  },
  {
   "id": "10400_L4001",
   "name": "繳費期間別 資料類型",
   "category": "格式",
   "level": "資料類型",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 42",
   "source": {
    "doc": "rules",
    "page": 54,
    "label": "伍-22",
    "program": 102
   }
  },
  {
   "id": "22000_L4002",
   "name": "繳費期間別 代碼",
   "category": "代碼",
   "level": "代碼",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 42；表 3．1．42 繳費期間別代號表",
   "source": {
    "doc": "rules",
    "page": 55,
    "label": "伍-23",
    "program": 102
   }
  },
  {
   "id": "10400_L4101",
   "name": "繳費期間 資料類型",
   "category": "格式",
   "level": "資料類型",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 43",
   "source": {
    "doc": "rules",
    "page": 55,
    "label": "伍-23",
    "program": 103
   }
  },
  {
   "id": "10400_L4201",
   "name": "累計繳費月數 資料類型",
   "category": "格式",
   "level": "資料類型",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 44",
   "source": {
    "doc": "rules",
    "page": 55,
    "label": "伍-23"
   }
  },
  {
   "id": "10400_L4301",
   "name": "停(失)效原因 資料類型",
   "category": "格式",
   "level": "資料類型",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 45",
   "source": {
    "doc": "rules",
    "page": 55,
    "label": "伍-23",
    "program": 104
   }
  },
  {
   "id": "22100_L4301",
   "name": "停(失)效原因 代碼",
   "category": "代碼",
   "level": "代碼",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 45；表 3．1．45 停(失)效原因代號表",
   "source": {
    "doc": "rules",
    "page": 55,
    "label": "伍-23",
    "program": 104
   }
  },
  {
   "id": "10400_L4401",
   "name": "職業分類代碼 資料類型",
   "category": "格式",
   "level": "資料類型",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 46",
   "source": {
    "doc": "rules",
    "page": 55,
    "label": "伍-23",
    "program": 105
   }
  },
  {
   "id": "10400_L4501",
   "name": "要保人住所郵遞區號 資料類型",
   "category": "格式",
   "level": "資料類型",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 47",
   "source": {
    "doc": "rules",
    "page": 55,
    "label": "伍-23",
    "note": "以舊編號 L4501 查得",
    "program": 106
   }
  },
  {
   "id": "22200_L4502",
   "name": "要保人住所郵遞區號 代碼",
   "category": "代碼",
   "level": "代碼",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 47；表 3．1．46 郵遞區號前 3 碼一覽表",
   "source": {
    "doc": "rules",
    "page": 55,
    "label": "伍-23",
    "program": 106
   }
  },
  {
   "id": "10400_L4601",
   "name": "被保險人住所郵遞區號 資料類型",
   "category": "格式",
   "level": "資料類型",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 48",
   "source": {
    "doc": "rules",
    "page": 56,
    "label": "伍-24",
    "note": "以舊編號 L4601 查得",
    "program": 106
   }
  },
  {
   "id": "22300_L4602",
   "name": "被保險人住所郵遞區號 代碼",
   "category": "代碼",
   "level": "代碼",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 48；表 3．1．46 郵遞區號前 3 碼一覽表",
   "source": {
    "doc": "rules",
    "page": 56,
    "label": "伍-24",
    "program": 106
   }
  },
  {
   "id": "10400_D0101",
   "name": "給付類別 資料類型",
   "category": "格式",
   "level": "資料類型",
   "severity": "error",
   "file": "D",
   "ref": "給付欄 1",
   "source": {
    "doc": "rules",
    "page": 58,
    "label": "伍-26",
    "program": 111
   }
  },
  {
   "id": "23000_D0102",
   "name": "給付類別 代碼",
   "category": "代碼",
   "level": "代碼",
   "severity": "error",
   "file": "D",
   "ref": "給付欄 1；表 3．2．1 給付類別代號表",
   "source": {
    "doc": "rules",
    "page": 58,
    "label": "伍-26",
    "program": 111
   }
  },
  {
   "id": "10400_D0201",
   "name": "公司代號 資料類型",
   "category": "格式",
   "level": "資料類型",
   "severity": "error",
   "file": "D",
   "ref": "給付欄 2",
   "source": {
    "doc": "rules",
    "page": 58,
    "label": "伍-26",
    "program": 111
   }
  },
  {
   "id": "D0202",
   "name": "公司代號 代碼",
   "category": "代碼",
   "level": "代碼",
   "severity": "error",
   "file": "D",
   "ref": "給付欄 2；表 3．1．1 公司代號表",
   "source": {
    "doc": "rules",
    "page": 58,
    "label": "伍-26",
    "program": 111
   }
  },
  {
   "id": "10400_D0301",
   "name": "保單編號 資料類型",
   "category": "格式",
   "level": "資料類型",
   "severity": "error",
   "file": "D",
   "ref": "給付欄 3",
   "source": {
    "doc": "rules",
    "page": 58,
    "label": "伍-26",
    "program": 112
   }
  },
  {
   "id": "10400_D0321",
   "name": "保單編號序號 資料類型",
   "category": "格式",
   "level": "資料類型",
   "severity": "error",
   "file": "D",
   "ref": "給付欄 4",
   "source": {
    "doc": "rules",
    "page": 58,
    "label": "伍-26",
    "program": 112
   }
  },
  {
   "id": "10400_D0411",
   "name": "證件種類 資料類型",
   "category": "格式",
   "level": "資料類型",
   "severity": "error",
   "file": "D",
   "ref": "給付欄 5",
   "source": {
    "doc": "rules",
    "page": 58,
    "label": "伍-26",
    "program": 112
   }
  },
  {
   "id": "D0412",
   "name": "證件種類 代碼",
   "category": "代碼",
   "level": "代碼",
   "severity": "error",
   "file": "D",
   "ref": "給付欄 5；證件類別代號表",
   "source": {
    "doc": "rules",
    "page": 58,
    "label": "伍-26",
    "program": 112
   }
  },
  {
   "id": "10400_D0421",
   "name": "證件編號 資料類型",
   "category": "格式",
   "level": "資料類型",
   "severity": "error",
   "file": "D",
   "ref": "給付欄 6",
   "source": {
    "doc": "rules",
    "page": 58,
    "label": "伍-26",
    "program": 112
   }
  },
  {
   "id": "10400_D0511",
   "name": "保險期間別 資料類型",
   "category": "格式",
   "level": "資料類型",
   "severity": "error",
   "file": "D",
   "ref": "給付欄 7",
   "source": {
    "doc": "rules",
    "page": 58,
    "label": "伍-26",
    "program": 112
   }
  },
  {
   "id": "D0512",
   "name": "保險期間別 代碼",
   "category": "代碼",
   "level": "代碼",
   "severity": "error",
   "file": "D",
   "ref": "給付欄 7；表 3．1．8 保險期間別代號表",
   "source": {
    "doc": "rules",
    "page": 58,
    "label": "伍-26",
    "program": 113
   }
  },
  {
   "id": "10400_D0521",
   "name": "保險期間 資料類型",
   "category": "格式",
   "level": "資料類型",
   "severity": "error",
   "file": "D",
   "ref": "給付欄 8",
   "source": {
    "doc": "rules",
    "page": 59,
    "label": "伍-27",
    "program": 113
   }
  },
  {
   "id": "10400_D0601",
   "name": "出生日期 資料類型",
   "category": "格式",
   "level": "資料類型",
   "severity": "error",
   "file": "D",
   "ref": "給付欄 9",
   "source": {
    "doc": "rules",
    "page": 59,
    "label": "伍-27",
    "program": 113
   }
  },
  {
   "id": "10400_D0701",
   "name": "性別 資料類型",
   "category": "格式",
   "level": "資料類型",
   "severity": "error",
   "file": "D",
   "ref": "給付欄 10",
   "source": {
    "doc": "rules",
    "page": 59,
    "label": "伍-27",
    "program": 113
   }
  },
  {
   "id": "D0702",
   "name": "性別 代碼",
   "category": "代碼",
   "level": "代碼",
   "severity": "error",
   "file": "D",
   "ref": "給付欄 10；性別代號",
   "source": {
    "doc": "rules",
    "page": 59,
    "label": "伍-27",
    "program": 113
   }
  },
  {
   "id": "10400_D0811",
   "name": "有無體檢 資料類型",
   "category": "格式",
   "level": "資料類型",
   "severity": "error",
   "file": "D",
   "ref": "給付欄 11",
   "source": {
    "doc": "rules",
    "page": 59,
    "label": "伍-27",
    "program": 114
   }
  },
  {
   "id": "D0812",
   "name": "有無體檢 代碼",
   "category": "代碼",
   "level": "代碼",
   "severity": "error",
   "file": "D",
   "ref": "給付欄 11；有無體檢代號表",
   "source": {
    "doc": "rules",
    "page": 59,
    "label": "伍-27",
    "program": 114
   }
  },
  {
   "id": "10400_D0821",
   "name": "體檢類別 資料類型",
   "category": "格式",
   "level": "資料類型",
   "severity": "error",
   "file": "D",
   "ref": "給付欄 12",
   "source": {
    "doc": "rules",
    "page": 59,
    "label": "伍-27",
    "program": 114
   }
  },
  {
   "id": "D0822",
   "name": "體檢類別 代碼",
   "category": "代碼",
   "level": "代碼",
   "severity": "error",
   "file": "D",
   "ref": "給付欄 12；體檢類別代號表",
   "source": {
    "doc": "rules",
    "page": 59,
    "label": "伍-27",
    "program": 114
   }
  },
  {
   "id": "10400_D0831",
   "name": "次標準體原因 資料類型",
   "category": "格式",
   "level": "資料類型",
   "severity": "error",
   "file": "D",
   "ref": "給付欄 13",
   "source": {
    "doc": "rules",
    "page": 59,
    "label": "伍-27",
    "program": 114
   }
  },
  {
   "id": "D0832",
   "name": "次標準體原因 代碼",
   "category": "代碼",
   "level": "代碼",
   "severity": "error",
   "file": "D",
   "ref": "給付欄 13；次標準體原因代號表",
   "source": {
    "doc": "rules",
    "page": 59,
    "label": "伍-27",
    "program": 114
   }
  },
  {
   "id": "10400_D0901",
   "name": "保險期間起日 資料類型",
   "category": "格式",
   "level": "資料類型",
   "severity": "error",
   "file": "D",
   "ref": "給付欄 14",
   "source": {
    "doc": "rules",
    "page": 59,
    "label": "伍-27",
    "program": 114
   }
  },
  {
   "id": "10400_D1001",
   "name": "發生日期 資料類型",
   "category": "格式",
   "level": "資料類型",
   "severity": "error",
   "file": "D",
   "ref": "給付欄 15",
   "source": {
    "doc": "rules",
    "page": 60,
    "label": "伍-28",
    "program": 115
   }
  },
  {
   "id": "10400_D1101",
   "name": "應給付金額(原幣金額) 資料類型",
   "category": "格式",
   "level": "資料類型",
   "severity": "error",
   "file": "D",
   "ref": "給付欄 16",
   "source": {
    "doc": "rules",
    "page": 60,
    "label": "伍-28",
    "program": 115
   }
  },
  {
   "id": "10400_D1201",
   "name": "實際給付金額(原幣金額) 資料類型",
   "category": "格式",
   "level": "資料類型",
   "severity": "error",
   "file": "D",
   "ref": "給付欄 17",
   "source": {
    "doc": "rules",
    "page": 60,
    "label": "伍-28",
    "program": 115
   }
  },
  {
   "id": "10400_D1301",
   "name": "應給付與實際給付金額不同原因 資料類型",
   "category": "格式",
   "level": "資料類型",
   "severity": "error",
   "file": "D",
   "ref": "給付欄 18",
   "source": {
    "doc": "rules",
    "page": 60,
    "label": "伍-28",
    "program": 115
   }
  },
  {
   "id": "10400_D1401",
   "name": "死亡及完全失能原因(ICD-10-CM) 資料類型",
   "category": "格式",
   "level": "資料類型",
   "severity": "error",
   "file": "D",
   "ref": "給付欄 19",
   "source": {
    "doc": "rules",
    "page": 60,
    "label": "伍-28",
    "program": 116
   }
  },
  {
   "id": "10400_D1501",
   "name": "完全失能項次等級 資料類型",
   "category": "格式",
   "level": "資料類型",
   "severity": "error",
   "file": "D",
   "ref": "給付欄 20",
   "source": {
    "doc": "rules",
    "page": 60,
    "label": "伍-28",
    "program": 116
   }
  },
  {
   "id": "10400_D1601",
   "name": "保險商品類別編號 資料類型",
   "category": "格式",
   "level": "資料類型",
   "severity": "error",
   "file": "D",
   "ref": "給付欄 21",
   "source": {
    "doc": "rules",
    "page": 61,
    "label": "伍-29",
    "program": 116
   }
  },
  {
   "id": "10400_D1701",
   "name": "原幣別 資料類型",
   "category": "格式",
   "level": "資料類型",
   "severity": "error",
   "file": "D",
   "ref": "給付欄 22",
   "source": {
    "doc": "rules",
    "page": 61,
    "label": "伍-29",
    "program": 118
   }
  },
  {
   "id": "D1701",
   "name": "原幣別 代碼",
   "category": "代碼",
   "level": "代碼",
   "severity": "error",
   "file": "D",
   "ref": "給付欄 22；幣別代號表",
   "source": {
    "doc": "rules",
    "page": 61,
    "label": "伍-29",
    "program": 118
   }
  },
  {
   "id": "10400_D1801",
   "name": "給付日期 資料類型",
   "category": "格式",
   "level": "資料類型",
   "severity": "error",
   "file": "D",
   "ref": "給付欄 23",
   "source": {
    "doc": "rules",
    "page": 61,
    "label": "伍-29",
    "program": 118
   }
  },
  {
   "id": "10400_D1901",
   "name": "事故時職業類別 資料類型",
   "category": "格式",
   "level": "資料類型",
   "severity": "error",
   "file": "D",
   "ref": "給付欄 24",
   "source": {
    "doc": "rules",
    "page": 62,
    "label": "伍-30",
    "program": 118
   }
  },
  {
   "id": "D1902",
   "name": "事故時職業類別 代碼",
   "category": "代碼",
   "level": "代碼",
   "severity": "error",
   "file": "D",
   "ref": "給付欄 24；職業類別代號表",
   "source": {
    "doc": "rules",
    "page": 62,
    "label": "伍-30",
    "program": 118
   }
  },
  {
   "id": "10400_D2001",
   "name": "身心障礙類別 資料類型",
   "category": "格式",
   "level": "資料類型",
   "severity": "error",
   "file": "D",
   "ref": "給付欄 25",
   "source": {
    "doc": "rules",
    "page": 62,
    "label": "伍-30",
    "program": 118
   }
  },
  {
   "id": "D2002",
   "name": "身心障礙類別 代碼",
   "category": "代碼",
   "level": "代碼",
   "severity": "error",
   "file": "D",
   "ref": "給付欄 25；身心障礙類別代號表",
   "source": {
    "doc": "rules",
    "page": 62,
    "label": "伍-30",
    "program": 118
   }
  },
  {
   "id": "10400_D2101",
   "name": "身心障礙等級 資料類型",
   "category": "格式",
   "level": "資料類型",
   "severity": "error",
   "file": "D",
   "ref": "給付欄 26",
   "source": {
    "doc": "rules",
    "page": 62,
    "label": "伍-30",
    "program": 119
   }
  },
  {
   "id": "D2102",
   "name": "身心障礙等級 代碼",
   "category": "代碼",
   "level": "代碼",
   "severity": "error",
   "file": "D",
   "ref": "給付欄 26；身心障礙等級代號表",
   "source": {
    "doc": "rules",
    "page": 62,
    "label": "伍-30",
    "program": 119
   }
  },
  {
   "id": "10400_D2201",
   "name": "公司保單險種代號 資料類型",
   "category": "格式",
   "level": "資料類型",
   "severity": "error",
   "file": "D",
   "ref": "給付欄 27",
   "source": {
    "doc": "rules",
    "page": 62,
    "label": "伍-30",
    "program": 119
   }
  },
  {
   "id": "10400",
   "name": "數字資料範圍錯誤",
   "category": "格式",
   "level": "資料類型",
   "severity": "error",
   "file": "L/D",
   "ref": "肆、檢核程式項目及代碼表 104",
   "source": {
    "doc": "rules",
    "page": 67,
    "label": "伍-35",
    "note": "肆、代碼表 104「數字資料範圍錯誤」"
   }
  },
  {
   "id": "20000",
   "name": "代碼檢核",
   "category": "代碼",
   "level": "代碼",
   "severity": "error",
   "file": "L/D",
   "ref": "代碼表",
   "source": {
    "doc": "rules",
    "page": 67,
    "label": "伍-35",
    "note": "肆、代碼表 2xx「代碼錯誤」"
   }
  },
  {
   "id": "L0422",
   "name": "證件編號暫填 0000000000",
   "category": "單筆邏輯",
   "level": "單筆",
   "severity": "warning",
   "file": "L",
   "ref": "承保欄 6",
   "source": {
    "doc": "rules",
    "page": 47,
    "label": "伍-15",
    "program": 81
   }
  },
  {
   "id": "L0501",
   "name": "新契約臺幣基本型保額不得小於 1 萬元",
   "category": "單筆邏輯",
   "level": "單筆",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 7",
   "source": {
    "doc": "rules",
    "page": 47,
    "label": "伍-15",
    "program": 81
   }
  },
  {
   "id": "24901_L0613",
   "name": "保險期間別=T 時保險期間≠999",
   "category": "單筆邏輯",
   "level": "單筆",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 8/9",
   "source": {
    "doc": "rules",
    "page": 47,
    "label": "伍-15",
    "program": 81
   }
  },
  {
   "id": "24902_L0613",
   "name": "保險期間別=Y 時保險期間=999 或 ≥095",
   "category": "單筆邏輯",
   "level": "單筆",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 8/9",
   "source": {
    "doc": "rules",
    "page": 47,
    "label": "伍-15",
    "program": 81
   }
  },
  {
   "id": "24903_L0613",
   "name": "保險期間別=B 時保險期間=001",
   "category": "單筆邏輯",
   "level": "單筆",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 8/9",
   "source": {
    "doc": "rules",
    "page": 47,
    "label": "伍-15",
    "program": 81
   }
  },
  {
   "id": "24904_L0613",
   "name": "保險期間別=W/G 時保險期間合理",
   "category": "單筆邏輯",
   "level": "單筆",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 8/9",
   "source": {
    "doc": "rules",
    "page": 47,
    "label": "伍-15",
    "program": 81
   }
  },
  {
   "id": "23900_L0802",
   "name": "出生日期為合法日期",
   "category": "單筆邏輯",
   "level": "單筆",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 10",
   "source": {
    "doc": "rules",
    "page": 47,
    "label": "伍-15",
    "program": 82
   }
  },
  {
   "id": "25001_L1233",
   "name": "次標準體原因=0 時體檢類別=1 或 3",
   "category": "單筆邏輯",
   "level": "單筆",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 13/14",
   "source": {
    "doc": "rules",
    "page": 48,
    "label": "伍-16",
    "program": 83
   }
  },
  {
   "id": "25002_L1233",
   "name": "次標準體原因≠0 時體檢類別=2",
   "category": "單筆邏輯",
   "level": "單筆",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 13/14",
   "source": {
    "doc": "rules",
    "page": 48,
    "label": "伍-16",
    "program": 83
   }
  },
  {
   "id": "24801_L1303",
   "name": "加保別 NEW/NCT 時異動序號為 00000 或 00001",
   "category": "單筆邏輯",
   "level": "單筆",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 4/15",
   "source": {
    "doc": "rules",
    "page": 48,
    "label": "伍-16",
    "program": 84
   }
  },
  {
   "id": "24802_L1304",
   "name": "加保別=NEW 時加保日期≠0",
   "category": "單筆邏輯",
   "level": "單筆",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 15/16",
   "source": {
    "doc": "rules",
    "page": 48,
    "label": "伍-16",
    "program": 84
   }
  },
  {
   "id": "24803_L1304",
   "name": "加保別=XED 時加保日期=0",
   "category": "單筆邏輯",
   "level": "單筆",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 15/16",
   "source": {
    "doc": "rules",
    "page": 48,
    "label": "伍-16",
    "program": 84
   }
  },
  {
   "id": "24804_L1304",
   "name": "加保別≠XED 時加保日期≠0",
   "category": "單筆邏輯",
   "level": "單筆",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 15/16",
   "source": {
    "doc": "rules",
    "page": 48,
    "label": "伍-16",
    "program": 84
   }
  },
  {
   "id": "24805_L1307",
   "name": "加保別=HCC 時危險分類欄位不可全為 0",
   "category": "單筆邏輯",
   "level": "單筆",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 15/27~29",
   "source": {
    "doc": "rules",
    "page": 48,
    "label": "伍-16",
    "program": 84
   }
  },
  {
   "id": "23900_L1402",
   "name": "加保日期為合法日期",
   "category": "單筆邏輯",
   "level": "單筆",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 16",
   "source": {
    "doc": "rules",
    "page": 49,
    "label": "伍-17",
    "program": 85
   }
  },
  {
   "id": "26001_L1403",
   "name": "加保日期 ≤ 退保日期",
   "category": "單筆邏輯",
   "level": "單筆",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 16/18",
   "source": {
    "doc": "rules",
    "page": 49,
    "label": "伍-17",
    "program": 85
   }
  },
  {
   "id": "26002_L1404",
   "name": "加保日期介於保險期間起迄日",
   "category": "單筆邏輯",
   "level": "單筆",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 16/21/22",
   "source": {
    "doc": "rules",
    "page": 49,
    "label": "伍-17",
    "program": 86
   }
  },
  {
   "id": "26101_L1502",
   "name": "加保別、退保別不能同時為 XED",
   "category": "單筆邏輯",
   "level": "單筆",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 15/17",
   "source": {
    "doc": "rules",
    "page": 49,
    "label": "伍-17",
    "program": 86
   }
  },
  {
   "id": "26102_L1503",
   "name": "退保別=MAD 時退保日期=保險期間迄日",
   "category": "單筆邏輯",
   "level": "單筆",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 17/18/22",
   "source": {
    "doc": "rules",
    "page": 49,
    "label": "伍-17",
    "program": 86
   }
  },
  {
   "id": "26104_L1504",
   "name": "退保別=XED 時退保日期=0；其餘退保日期≠0",
   "category": "單筆邏輯",
   "level": "單筆",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 17/18",
   "source": {
    "doc": "rules",
    "page": 49,
    "label": "伍-17",
    "program": 86
   }
  },
  {
   "id": "23900_L1602",
   "name": "退保日期為合法日期",
   "category": "單筆邏輯",
   "level": "單筆",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 18",
   "source": {
    "doc": "rules",
    "page": 50,
    "label": "伍-18",
    "program": 88
   }
  },
  {
   "id": "26201_L1603",
   "name": "退保日期不可超過滿期日",
   "category": "單筆邏輯",
   "level": "單筆",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 18/22",
   "source": {
    "doc": "rules",
    "page": 50,
    "label": "伍-18",
    "program": 88
   }
  },
  {
   "id": "26203_L1607",
   "name": "退保日期 ≥ 加保日期",
   "category": "單筆邏輯",
   "level": "單筆",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 16/18",
   "source": {
    "doc": "rules",
    "page": 50,
    "label": "伍-18",
    "program": 89
   }
  },
  {
   "id": "L1605",
   "name": "退保日期 ≥ 保險期間起日",
   "category": "單筆邏輯",
   "level": "單筆",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 18/21",
   "source": {
    "doc": "rules",
    "page": 50,
    "label": "伍-18",
    "program": 89
   }
  },
  {
   "id": "26700_L0303",
   "name": "異動序號=00001 時退保別不可為終止類",
   "category": "單筆邏輯",
   "level": "單筆",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 4/17",
   "source": {
    "doc": "rules",
    "page": 46,
    "label": "伍-14",
    "program": 80
   }
  },
  {
   "id": "25102_L1703",
   "name": "分紅類別 S/T/C/D/P/Q：起日 < 2004/01/01",
   "category": "單筆邏輯",
   "level": "單筆",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 19/21",
   "source": {
    "doc": "rules",
    "page": 50,
    "label": "伍-18",
    "program": 89
   }
  },
  {
   "id": "25101_L1704",
   "name": "分紅類別 A/B/M/N/Y/X：起日 ≥ 2004/01/01",
   "category": "單筆邏輯",
   "level": "單筆",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 19/21",
   "source": {
    "doc": "rules",
    "page": 50,
    "label": "伍-18",
    "program": 90
   }
  },
  {
   "id": "21001_L1803",
   "name": "保險商品類別編號編碼原則",
   "category": "單筆邏輯",
   "level": "單筆",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 20；表 3．1．20",
   "source": {
    "doc": "rules",
    "page": 50,
    "label": "伍-18",
    "program": 90
   }
  },
  {
   "id": "21003_L1804",
   "name": "商品類別編號第 4、5 碼組合",
   "category": "單筆邏輯",
   "level": "單筆",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 20",
   "source": {
    "doc": "rules",
    "page": 50,
    "label": "伍-18",
    "program": 91
   }
  },
  {
   "id": "21008_L1805",
   "name": "投資型/萬能型第 9-10 碼與第 4、8 碼",
   "category": "單筆邏輯",
   "level": "單筆",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 20",
   "source": {
    "doc": "rules",
    "page": 50,
    "label": "伍-18",
    "program": 91
   }
  },
  {
   "id": "21011_L1806",
   "name": "商品類別編號第 4 碼與第 9-10 碼組合",
   "category": "單筆邏輯",
   "level": "單筆",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 20",
   "source": {
    "doc": "rules",
    "page": 51,
    "label": "伍-19",
    "program": 92
   }
  },
  {
   "id": "23900_L1902",
   "name": "保險期間起日為合法日期",
   "category": "單筆邏輯",
   "level": "單筆",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 21",
   "source": {
    "doc": "rules",
    "page": 51,
    "label": "伍-19",
    "program": 93
   }
  },
  {
   "id": "24200_L1903",
   "name": "保險期間起日 ≥ 出生日期",
   "category": "單筆邏輯",
   "level": "單筆",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 10/21",
   "source": {
    "doc": "rules",
    "page": 51,
    "label": "伍-19",
    "program": 94
   }
  },
  {
   "id": "24300_L1904",
   "name": "加保別 NEW/NCT 時起日=加保日期",
   "category": "單筆邏輯",
   "level": "單筆",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 16/21",
   "source": {
    "doc": "rules",
    "page": 51,
    "label": "伍-19",
    "program": 94
   }
  },
  {
   "id": "23900_L2002",
   "name": "保險期間迄日為合法日期",
   "category": "單筆邏輯",
   "level": "單筆",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 22",
   "source": {
    "doc": "rules",
    "page": 51,
    "label": "伍-19",
    "program": 94
   }
  },
  {
   "id": "25201_L2003",
   "name": "保險期間迄日 > 起日",
   "category": "單筆邏輯",
   "level": "單筆",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 21/22",
   "source": {
    "doc": "rules",
    "page": 51,
    "label": "伍-19",
    "program": 94
   }
  },
  {
   "id": "25203_L2004",
   "name": "歲滿期(W)迄日與出生日期、保險期間相符",
   "category": "單筆邏輯",
   "level": "單筆",
   "severity": "warning",
   "file": "L",
   "ref": "承保欄 9/10/22",
   "source": {
    "doc": "rules",
    "page": 51,
    "label": "伍-19",
    "program": 94
   }
  },
  {
   "id": "25204_L2005",
   "name": "年滿期(T)迄日=起日+保險期間-1天",
   "category": "單筆邏輯",
   "level": "單筆",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 9/21/22",
   "source": {
    "doc": "rules",
    "page": 51,
    "label": "伍-19",
    "program": 94
   }
  },
  {
   "id": "25301_L2103",
   "name": "還本型態=1 且 W 時保險期間 <95",
   "category": "單筆邏輯",
   "level": "單筆",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 23",
   "source": {
    "doc": "rules",
    "page": 51,
    "label": "伍-19",
    "program": 95
   }
  },
  {
   "id": "25302_L2104",
   "name": "還本型態=2 時保險期間為終身或 W≥95",
   "category": "單筆邏輯",
   "level": "單筆",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 23",
   "source": {
    "doc": "rules",
    "page": 51,
    "label": "伍-19",
    "program": 95
   }
  },
  {
   "id": "25303_L2105",
   "name": "生存險/生死合險還本型態不為 0",
   "category": "單筆邏輯",
   "level": "單筆",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 20/23",
   "source": {
    "doc": "rules",
    "page": 51,
    "label": "伍-19",
    "program": 95
   }
  },
  {
   "id": "25304_L2106",
   "name": "定期/終身壽險還本型態為 0",
   "category": "單筆邏輯",
   "level": "單筆",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 20/23",
   "source": {
    "doc": "rules",
    "page": 51,
    "label": "伍-19",
    "program": 95
   }
  },
  {
   "id": "26301_L2302",
   "name": "有祝壽保險金時給付年齡 ≥95",
   "category": "單筆邏輯",
   "level": "單筆",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 25/53",
   "source": {
    "doc": "rules",
    "page": 52,
    "label": "伍-20",
    "program": 96
   }
  },
  {
   "id": "26302_L2303",
   "name": "祝壽金給付年齡>0 時保險期間為終身",
   "category": "單筆邏輯",
   "level": "單筆",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 8/25",
   "source": {
    "doc": "rules",
    "page": 52,
    "label": "伍-20",
    "program": 96
   }
  },
  {
   "id": "24400_L2503",
   "name": "吸煙分類≠0 時商品編碼第 17 碼=2",
   "category": "單筆邏輯",
   "level": "單筆",
   "severity": "warning",
   "file": "L",
   "ref": "承保欄 27/41",
   "source": {
    "doc": "rules",
    "page": 52,
    "label": "伍-20",
    "program": 96
   }
  },
  {
   "id": "24601_L2703",
   "name": "身障等級=0 時身障類別=000",
   "category": "單筆邏輯",
   "level": "單筆",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 28/29",
   "source": {
    "doc": "rules",
    "page": 52,
    "label": "伍-20",
    "program": 97
   }
  },
  {
   "id": "24602_L2703",
   "name": "身障等級≠0 時身障類別≠000",
   "category": "單筆邏輯",
   "level": "單筆",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 28/29",
   "source": {
    "doc": "rules",
    "page": 52,
    "label": "伍-20",
    "program": 97
   }
  },
  {
   "id": "25501_L2803",
   "name": "經濟弱勢身分≠0 時為微型保單(第 8 碼=4)",
   "category": "單筆邏輯",
   "level": "單筆",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 20/30",
   "source": {
    "doc": "rules",
    "page": 51,
    "label": "伍-19",
    "program": 92
   }
  },
  {
   "id": "25502_L2804",
   "name": "經濟弱勢身分與集體投保連結關係",
   "category": "單筆邏輯",
   "level": "單筆",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 30/31",
   "source": {
    "doc": "rules",
    "page": 51,
    "label": "伍-19",
    "program": 92
   }
  },
  {
   "id": "25601_L2903",
   "name": "集體投保連結關係≠0 時為微型保單",
   "category": "單筆邏輯",
   "level": "單筆",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 20/31",
   "source": {
    "doc": "rules",
    "page": 51,
    "label": "伍-19",
    "program": 92
   }
  },
  {
   "id": "25602_L2904",
   "name": "集體投保連結關係≠0 時經濟弱勢身分≠0",
   "category": "單筆邏輯",
   "level": "單筆",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 30/31",
   "source": {
    "doc": "rules",
    "page": 53,
    "label": "伍-21",
    "program": 98
   }
  },
  {
   "id": "L3903",
   "name": "商品編號版本=1 時編號2 全 0；=2 時不為全 0",
   "category": "單筆邏輯",
   "level": "單筆",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 40/41",
   "source": {
    "doc": "rules",
    "page": 54,
    "label": "伍-22",
    "program": 102
   }
  },
  {
   "id": "L3904",
   "name": "起日 ≥ 2017/03/21 應使用 27 碼商品編號",
   "category": "單筆邏輯",
   "level": "單筆",
   "severity": "warning",
   "file": "L",
   "ref": "承保欄 21/41",
   "source": {
    "doc": "rules",
    "page": 54,
    "label": "伍-22",
    "program": 102
   }
  },
  {
   "id": "25701_L4102",
   "name": "繳費期間不能比保險期間大",
   "category": "單筆邏輯",
   "level": "單筆",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 9/43",
   "source": {
    "doc": "rules",
    "page": 55,
    "label": "伍-23",
    "program": 103
   }
  },
  {
   "id": "25702_L4103",
   "name": "躉繳/彈性繳時繳費期間=000，其餘為年期",
   "category": "單筆邏輯",
   "level": "單筆",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 42/43",
   "source": {
    "doc": "rules",
    "page": 55,
    "label": "伍-23",
    "program": 103
   }
  },
  {
   "id": "25800_L4201",
   "name": "停效/失效時累計繳費月數一定要有值",
   "category": "單筆邏輯",
   "level": "單筆",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 17/44",
   "source": {
    "doc": "rules",
    "page": 55,
    "label": "伍-23",
    "program": 103
   }
  },
  {
   "id": "25802_L4203",
   "name": "累計繳費月數與理論值 vs 停失效原因",
   "category": "單筆邏輯",
   "level": "單筆",
   "severity": "warning",
   "file": "L",
   "ref": "承保欄 44/45",
   "source": {
    "doc": "rules",
    "page": 55,
    "label": "伍-23",
    "program": 103
   }
  },
  {
   "id": "25805_L4202",
   "name": "停(失)效原因與退保別一致",
   "category": "單筆邏輯",
   "level": "單筆",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 17/45",
   "source": {
    "doc": "rules",
    "page": 55,
    "label": "伍-23",
    "program": 104
   }
  },
  {
   "id": "L4401",
   "name": "2015/03/01 後生效保單職業分類代碼不可為 00000000",
   "category": "單筆邏輯",
   "level": "單筆",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 46",
   "source": {
    "doc": "rules",
    "page": 55,
    "label": "伍-23",
    "program": 105
   }
  },
  {
   "id": "L4403",
   "name": "職業類別 0/8 時職業分類代碼=00000000",
   "category": "單筆邏輯",
   "level": "單筆",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 37/46",
   "source": {
    "doc": "rules",
    "page": 55,
    "label": "伍-23",
    "program": 105
   }
  },
  {
   "id": "24701_L4501",
   "name": "郵遞區號 999 僅限 2019 年前契約",
   "category": "單筆邏輯",
   "level": "單筆",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 47/48",
   "source": {
    "doc": "rules",
    "page": 55,
    "label": "伍-23",
    "program": 106
   }
  },
  {
   "id": "L4701",
   "name": "彈性繳時應繳總保費合計=0",
   "category": "單筆邏輯",
   "level": "單筆",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 42/49/50",
   "source": {
    "doc": "rules",
    "page": 110,
    "label": "伍-78"
   }
  },
  {
   "id": "L5501",
   "name": "還本型態=0 時生存還本金給付條件=0",
   "category": "單筆邏輯",
   "level": "單筆",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 23/57",
   "source": {
    "doc": "manual",
    "page": 32,
    "label": "30",
    "note": "承保欄 57 生存還本金給付條件"
   }
  },
  {
   "id": "L5601",
   "name": "生存還本金初次給付日期為合法日期且 > 起日",
   "category": "單筆邏輯",
   "level": "單筆",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 58",
   "source": {
    "doc": "rules",
    "page": 57,
    "label": "伍-25",
    "note": "承保欄 58 生存還本金初次給付日期"
   }
  },
  {
   "id": "L6101",
   "name": "保留欄位填 0000",
   "category": "單筆邏輯",
   "level": "單筆",
   "severity": "warning",
   "file": "L",
   "ref": "承保欄 61",
   "source": {
    "doc": "manual",
    "page": 32,
    "label": "30",
    "note": "承保欄 61 保留欄位"
   }
  },
  {
   "id": "30201_L0302",
   "name": "保單只有一筆時異動序號=00000",
   "category": "多筆邏輯",
   "level": "多筆",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 4",
   "source": {
    "doc": "rules",
    "page": 46,
    "label": "伍-14",
    "program": 80
   }
  },
  {
   "id": "30202_L0302",
   "name": "多筆異動時異動序號自 00001 起依序",
   "category": "多筆邏輯",
   "level": "多筆",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 4",
   "source": {
    "doc": "rules",
    "page": 46,
    "label": "伍-14",
    "program": 80
   }
  },
  {
   "id": "K0001",
   "name": "主鍵重複 (保單號碼+異動序號)",
   "category": "多筆邏輯",
   "level": "多筆",
   "severity": "error",
   "file": "L",
   "ref": "key 值",
   "source": {
    "doc": "rules",
    "page": 46,
    "label": "伍-14",
    "note": "同保單異動序號不可重複"
   }
  },
  {
   "id": "30245_P1307",
   "name": "加保別 NEW 只會出現 1 次且為第一筆",
   "category": "多筆邏輯",
   "level": "多筆",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 15",
   "source": {
    "doc": "rules",
    "page": 48,
    "label": "伍-16",
    "program": 85
   }
  },
  {
   "id": "30212_L1305",
   "name": "加保別=上一筆退保別，加保日=上一筆退保日",
   "category": "多筆邏輯",
   "level": "多筆",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 15~18",
   "source": {
    "doc": "rules",
    "page": 48,
    "label": "伍-16",
    "program": 84
   }
  },
  {
   "id": "30213_L1306",
   "name": "上一筆退保別=LNN 時本筆加保別=RNN",
   "category": "多筆邏輯",
   "level": "多筆",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 15/17",
   "source": {
    "doc": "rules",
    "page": 48,
    "label": "伍-16",
    "program": 84
   }
  },
  {
   "id": "30214_L1306",
   "name": "加保別=RNN 時上一筆退保別=LNN",
   "category": "多筆邏輯",
   "level": "多筆",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 15/17",
   "source": {
    "doc": "rules",
    "page": 48,
    "label": "伍-16",
    "program": 84
   }
  },
  {
   "id": "30222_P1401",
   "name": "加保日期 ≥ 上一筆退保日期",
   "category": "多筆邏輯",
   "level": "多筆",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 16/18",
   "source": {
    "doc": "rules",
    "page": 49,
    "label": "伍-17",
    "program": 86
   }
  },
  {
   "id": "30228_P1504",
   "name": "終止類退保別應為保單最後一筆",
   "category": "多筆邏輯",
   "level": "多筆",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 17",
   "source": {
    "doc": "rules",
    "page": 49,
    "label": "伍-17",
    "program": 87
   }
  },
  {
   "id": "30233_P1601",
   "name": "退保日期 ≥ 上一筆退保日期",
   "category": "多筆邏輯",
   "level": "多筆",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 18",
   "source": {
    "doc": "rules",
    "page": 50,
    "label": "伍-18",
    "program": 89
   }
  },
  {
   "id": "30205_P0502",
   "name": "加保別=INN 時保額 > 上一筆",
   "category": "多筆邏輯",
   "level": "多筆",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 7/15",
   "source": {
    "doc": "rules",
    "page": 47,
    "label": "伍-15",
    "program": 81
   }
  },
  {
   "id": "30206_P0503",
   "name": "加保別=DNN 時保額 < 上一筆",
   "category": "多筆邏輯",
   "level": "多筆",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 7/15",
   "source": {
    "doc": "rules",
    "page": 47,
    "label": "伍-15",
    "program": 81
   }
  },
  {
   "id": "30215_P3401",
   "name": "疾病身故保險金上下一致 (INN/DNN/INV 除外)",
   "category": "多筆邏輯",
   "level": "多筆",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 36",
   "source": {
    "doc": "rules",
    "page": 53,
    "label": "伍-21",
    "program": 100
   }
  },
  {
   "id": "30217_P1302",
   "name": "加保別=HCC 時危險分類或職業類別須有變動",
   "category": "多筆邏輯",
   "level": "多筆",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 27~29/37",
   "source": {
    "doc": "rules",
    "page": 48,
    "label": "伍-16",
    "program": 84
   }
  },
  {
   "id": "30234_P2601",
   "name": "身障類別上下一致 (HCC 除外)",
   "category": "多筆邏輯",
   "level": "多筆",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 28",
   "source": {
    "doc": "rules",
    "page": 52,
    "label": "伍-20",
    "program": 97
   }
  },
  {
   "id": "30235_P2701",
   "name": "身障等級上下一致 (HCC 除外)",
   "category": "多筆邏輯",
   "level": "多筆",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 29",
   "source": {
    "doc": "rules",
    "page": 52,
    "label": "伍-20",
    "program": 97
   }
  },
  {
   "id": "30203_P1801",
   "name": "展期(ROL)後商品類別編號才能為 ETI",
   "category": "多筆邏輯",
   "level": "多筆",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 20",
   "source": {
    "doc": "rules",
    "page": 51,
    "label": "伍-19",
    "program": 93
   }
  },
  {
   "id": "30210_P0702",
   "name": "展期時保險期間 ≤ 上一筆",
   "category": "多筆邏輯",
   "level": "多筆",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 9",
   "source": {
    "doc": "rules",
    "page": 47,
    "label": "伍-15",
    "program": 82
   }
  },
  {
   "id": "30402_P1508",
   "name": "退保別=HLM 時到達年齡=祝壽保險金給付年齡",
   "category": "多筆邏輯",
   "level": "多筆",
   "severity": "warning",
   "file": "L",
   "ref": "承保欄 18/25",
   "source": {
    "doc": "rules",
    "page": 49,
    "label": "伍-17",
    "program": 88
   }
  },
  {
   "id": "LINS",
   "name": "加保別=INS 時保額欄位與上一筆相同",
   "category": "多筆邏輯",
   "level": "多筆",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 7/36/59/60",
   "source": {
    "doc": "rules",
    "page": 49,
    "label": "伍-17",
    "note": "加保別/退保別 INS 時保額欄位"
   }
  },
  {
   "id": "30101_P0101",
   "name": "公司代號上下筆相同",
   "category": "多筆邏輯",
   "level": "多筆",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 1",
   "source": {
    "doc": "rules",
    "page": 46,
    "label": "伍-14",
    "program": 79
   }
  },
  {
   "id": "30107_P0901",
   "name": "性別上下筆相同",
   "category": "多筆邏輯",
   "level": "多筆",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 11",
   "source": {
    "doc": "rules",
    "page": 48,
    "label": "伍-16",
    "program": 83
   }
  },
  {
   "id": "30108_P0801",
   "name": "出生日期上下筆相同",
   "category": "多筆邏輯",
   "level": "多筆",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 10",
   "source": {
    "doc": "rules",
    "page": 47,
    "label": "伍-15",
    "program": 82
   }
  },
  {
   "id": "30109_P1011",
   "name": "有無體檢上下筆相同",
   "category": "多筆邏輯",
   "level": "多筆",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 12",
   "source": {
    "doc": "rules",
    "page": 48,
    "label": "伍-16",
    "program": 83
   }
  },
  {
   "id": "30110_P1121",
   "name": "體檢類別上下筆相同",
   "category": "多筆邏輯",
   "level": "多筆",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 13",
   "source": {
    "doc": "rules",
    "page": 48,
    "label": "伍-16",
    "program": 83
   }
  },
  {
   "id": "30114_P1231",
   "name": "次標準體原因上下筆相同",
   "category": "多筆邏輯",
   "level": "多筆",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 14",
   "source": {
    "doc": "rules",
    "page": 48,
    "label": "伍-16",
    "program": 83
   }
  },
  {
   "id": "30104_P1901",
   "name": "保險期間起日上下筆相同",
   "category": "多筆邏輯",
   "level": "多筆",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 21",
   "source": {
    "doc": "rules",
    "page": 51,
    "label": "伍-19",
    "program": 94
   }
  },
  {
   "id": "30113_P3301",
   "name": "原幣別上下筆相同",
   "category": "多筆邏輯",
   "level": "多筆",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 35",
   "source": {
    "doc": "rules",
    "page": 53,
    "label": "伍-21",
    "program": 99
   }
  },
  {
   "id": "30123_P2801",
   "name": "經濟弱勢者身分上下筆相同",
   "category": "多筆邏輯",
   "level": "多筆",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 30",
   "source": {
    "doc": "rules",
    "page": 53,
    "label": "伍-21",
    "program": 98
   }
  },
  {
   "id": "30124_P2901",
   "name": "集體投保之連結關係上下筆相同",
   "category": "多筆邏輯",
   "level": "多筆",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 31",
   "source": {
    "doc": "rules",
    "page": 53,
    "label": "伍-21",
    "program": 98
   }
  },
  {
   "id": "30102_P3001",
   "name": "通路別上下筆相同",
   "category": "多筆邏輯",
   "level": "多筆",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 32",
   "source": {
    "doc": "rules",
    "page": 53,
    "label": "伍-21",
    "program": 99
   }
  },
  {
   "id": "30103_P3101",
   "name": "招攬方式上下筆相同",
   "category": "多筆邏輯",
   "level": "多筆",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 33",
   "source": {
    "doc": "rules",
    "page": 53,
    "label": "伍-21",
    "program": 99
   }
  },
  {
   "id": "30106_P0421",
   "name": "證件編號上下筆相同",
   "category": "多筆邏輯",
   "level": "多筆",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 6",
   "source": {
    "doc": "rules",
    "page": 47,
    "label": "伍-15",
    "program": 81
   }
  },
  {
   "id": "30208_P0611",
   "name": "保險期間別上下筆相同 (ROL/CTC 除外)",
   "category": "多筆邏輯",
   "level": "多筆",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 8",
   "source": {
    "doc": "rules",
    "page": 47,
    "label": "伍-15",
    "program": 82
   }
  },
  {
   "id": "30209_P0701",
   "name": "保險期間上下筆相同 (ROL/CTC 除外)",
   "category": "多筆邏輯",
   "level": "多筆",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 9",
   "source": {
    "doc": "rules",
    "page": 47,
    "label": "伍-15",
    "program": 82
   }
  },
  {
   "id": "30115_P1701",
   "name": "保單分紅類別上下筆相同 (CTC 除外)",
   "category": "多筆邏輯",
   "level": "多筆",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 19",
   "source": {
    "doc": "rules",
    "page": 50,
    "label": "伍-18",
    "program": 90
   }
  },
  {
   "id": "30231_P2001",
   "name": "保險期間迄日上下筆相同 (ROL/CTC 除外)",
   "category": "多筆邏輯",
   "level": "多筆",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 22",
   "source": {
    "doc": "rules",
    "page": 51,
    "label": "伍-19",
    "program": 94
   }
  },
  {
   "id": "30117_P1801",
   "name": "還本型態上下筆相同 (ROL/CTC 除外)",
   "category": "多筆邏輯",
   "level": "多筆",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 23",
   "source": {
    "doc": "rules",
    "page": 52,
    "label": "伍-20",
    "program": 95
   }
  },
  {
   "id": "30121_P2301",
   "name": "祝壽保險金給付年齡上下筆相同 (ROL/CTC 除外)",
   "category": "多筆邏輯",
   "level": "多筆",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 25",
   "source": {
    "doc": "rules",
    "page": 52,
    "label": "伍-20",
    "program": 96
   }
  },
  {
   "id": "LU3801",
   "name": "保險商品編號適用版本代號上下筆相同 (CTC 除外)",
   "category": "多筆邏輯",
   "level": "多筆",
   "severity": "error",
   "file": "L",
   "ref": "承保欄 40",
   "source": {
    "doc": "rules",
    "page": 54,
    "label": "伍-22",
    "program": 102
   }
  },
  {
   "id": "26501_D0103",
   "name": "給付類別與完全失能項次相呼應",
   "category": "單筆邏輯",
   "level": "單筆",
   "severity": "error",
   "file": "D",
   "ref": "給付欄 1/20",
   "source": {
    "doc": "rules",
    "page": 58,
    "label": "伍-26",
    "program": 111
   }
  },
  {
   "id": "D0513",
   "name": "保險期間別與保險期間相符",
   "category": "單筆邏輯",
   "level": "單筆",
   "severity": "warning",
   "file": "D",
   "ref": "給付欄 7/8",
   "source": {
    "doc": "rules",
    "page": 59,
    "label": "伍-27",
    "program": 113
   }
  },
  {
   "id": "23900_D0601",
   "name": "出生日期為合法日期",
   "category": "單筆邏輯",
   "level": "單筆",
   "severity": "error",
   "file": "D",
   "ref": "給付欄 9",
   "source": {
    "doc": "rules",
    "page": 59,
    "label": "伍-27",
    "program": 113
   }
  },
  {
   "id": "26800_D0602",
   "name": "出生日期 ≤ 保險期間起日",
   "category": "單筆邏輯",
   "level": "單筆",
   "severity": "error",
   "file": "D",
   "ref": "給付欄 9/14",
   "source": {
    "doc": "rules",
    "page": 59,
    "label": "伍-27",
    "program": 113
   }
  },
  {
   "id": "25001_D0831",
   "name": "次標準體原因與體檢類別相符",
   "category": "單筆邏輯",
   "level": "單筆",
   "severity": "error",
   "file": "D",
   "ref": "給付欄 12/13",
   "source": {
    "doc": "rules",
    "page": 59,
    "label": "伍-27",
    "program": 114
   }
  },
  {
   "id": "23900_D0901",
   "name": "保險期間起日為合法日期",
   "category": "單筆邏輯",
   "level": "單筆",
   "severity": "error",
   "file": "D",
   "ref": "給付欄 14",
   "source": {
    "doc": "rules",
    "page": 60,
    "label": "伍-28",
    "program": 114
   }
  },
  {
   "id": "23900_D1001",
   "name": "發生日期為合法日期",
   "category": "單筆邏輯",
   "level": "單筆",
   "severity": "error",
   "file": "D",
   "ref": "給付欄 15",
   "source": {
    "doc": "rules",
    "page": 60,
    "label": "伍-28",
    "program": 115
   }
  },
  {
   "id": "26600_D1002",
   "name": "發生日期 > 保險期間起日",
   "category": "單筆邏輯",
   "level": "單筆",
   "severity": "error",
   "file": "D",
   "ref": "給付欄 14/15",
   "source": {
    "doc": "rules",
    "page": 60,
    "label": "伍-28",
    "program": 115
   }
  },
  {
   "id": "23100_D1302",
   "name": "不同原因代號",
   "category": "單筆邏輯",
   "level": "單筆",
   "severity": "error",
   "file": "D",
   "ref": "給付欄 18；表 3．2．18",
   "source": {
    "doc": "rules",
    "page": 60,
    "label": "伍-28",
    "program": 115
   }
  },
  {
   "id": "24101_D1303",
   "name": "不同原因與應付/實付金額一致",
   "category": "單筆邏輯",
   "level": "單筆",
   "severity": "error",
   "file": "D",
   "ref": "給付欄 16~18",
   "source": {
    "doc": "rules",
    "page": 60,
    "label": "伍-28",
    "program": 115
   }
  },
  {
   "id": "26901_D1402",
   "name": "死亡/失能給付須填 ICD-10-CM；其他給付填 00000",
   "category": "單筆邏輯",
   "level": "單筆",
   "severity": "error",
   "file": "D",
   "ref": "給付欄 19",
   "source": {
    "doc": "rules",
    "page": 60,
    "label": "伍-28",
    "program": 116
   }
  },
  {
   "id": "D1601",
   "name": "保險商品類別編號編碼原則",
   "category": "單筆邏輯",
   "level": "單筆",
   "severity": "error",
   "file": "D",
   "ref": "給付欄 21",
   "source": {
    "doc": "rules",
    "page": 61,
    "label": "伍-29",
    "program": 116
   }
  },
  {
   "id": "23900_D1802",
   "name": "給付日期為合法日期",
   "category": "單筆邏輯",
   "level": "單筆",
   "severity": "error",
   "file": "D",
   "ref": "給付欄 23",
   "source": {
    "doc": "rules",
    "page": 61,
    "label": "伍-29",
    "program": 118
   }
  },
  {
   "id": "26400_D1803",
   "name": "給付日期 ≥ 發生日期",
   "category": "單筆邏輯",
   "level": "單筆",
   "severity": "error",
   "file": "D",
   "ref": "給付欄 15/23",
   "source": {
    "doc": "rules",
    "page": 62,
    "label": "伍-30",
    "program": 118
   }
  },
  {
   "id": "D2003",
   "name": "身障類別與身障等級同時為 0 或同時不為 0",
   "category": "單筆邏輯",
   "level": "單筆",
   "severity": "error",
   "file": "D",
   "ref": "給付欄 25/26",
   "source": {
    "doc": "rules",
    "page": 62,
    "label": "伍-30",
    "program": 118
   }
  },
  {
   "id": "30301_LD012",
   "name": "死亡/失能/生命末期退保須有給付資料",
   "category": "跨檔",
   "level": "跨檔",
   "severity": "error",
   "file": "L/D",
   "ref": "LD00-01",
   "source": {
    "doc": "rules",
    "page": 63,
    "label": "伍-31",
    "program": 123
   }
  },
  {
   "id": "30307_LD013",
   "name": "給付資料須有對應承保資料",
   "category": "跨檔",
   "level": "跨檔",
   "severity": "error",
   "file": "L/D",
   "ref": "LD00-02",
   "source": {
    "doc": "rules",
    "page": 63,
    "label": "伍-31",
    "program": 123
   }
  },
  {
   "id": "30304_LD014",
   "name": "退保別 DEA/ADS 須有給付類別=1",
   "category": "跨檔",
   "level": "跨檔",
   "severity": "error",
   "file": "L/D",
   "ref": "LD00-03",
   "source": {
    "doc": "rules",
    "page": 63,
    "label": "伍-31",
    "program": 123
   }
  },
  {
   "id": "30305_LD015",
   "name": "退保別 TDI/ATS 須有給付類別=2",
   "category": "跨檔",
   "level": "跨檔",
   "severity": "error",
   "file": "L/D",
   "ref": "LD00-04",
   "source": {
    "doc": "rules",
    "page": 63,
    "label": "伍-31",
    "program": 123
   }
  },
  {
   "id": "30306_LD016",
   "name": "退保別 ABD 須有給付類別=3",
   "category": "跨檔",
   "level": "跨檔",
   "severity": "error",
   "file": "L/D",
   "ref": "LD00-05",
   "source": {
    "doc": "rules",
    "page": 63,
    "label": "伍-31",
    "program": 124
   }
  },
  {
   "id": "30311_LD018",
   "name": "給付類別與承保退保別一致",
   "category": "跨檔",
   "level": "跨檔",
   "severity": "error",
   "file": "L/D",
   "ref": "LD00-07/09/11",
   "source": {
    "doc": "rules",
    "page": 63,
    "label": "伍-31",
    "program": 124
   }
  },
  {
   "id": "30312_LD019",
   "name": "承保退保日期=給付發生日期",
   "category": "跨檔",
   "level": "跨檔",
   "severity": "error",
   "file": "L/D",
   "ref": "LD00-08/10/12",
   "source": {
    "doc": "rules",
    "page": 63,
    "label": "伍-31",
    "program": 124
   }
  },
  {
   "id": "LD00-13",
   "name": "退保別 SIB/HLM/MAB 須有給付類別 4/5/6",
   "category": "跨檔",
   "level": "跨檔",
   "severity": "error",
   "file": "L/D",
   "ref": "LD00-13~15",
   "source": {
    "doc": "rules",
    "page": 64,
    "label": "伍-32"
   }
  },
  {
   "id": "LD00-16",
   "name": "祝壽金給付時到達年齡 ≥ 祝壽保險金給付年齡",
   "category": "跨檔",
   "level": "跨檔",
   "severity": "error",
   "file": "L/D",
   "ref": "LD00-16",
   "source": {
    "doc": "rules",
    "page": 64,
    "label": "伍-32"
   }
  },
  {
   "id": "30308_LD000",
   "name": "給付檔欄位=事故時承保檔欄位",
   "category": "跨檔",
   "level": "跨檔",
   "severity": "error",
   "file": "L/D",
   "ref": "LD01~LD13",
   "source": {
    "doc": "rules",
    "page": 63,
    "label": "伍-31",
    "note": "給付檔欄位=事故時承保檔欄位 (LD01–LD13)"
   }
  },
  {
   "id": "30309_LD012",
   "name": "疾病死亡應給付金額=疾病身故保險金",
   "category": "跨檔",
   "level": "跨檔",
   "severity": "warning",
   "file": "L/D",
   "ref": "LD11",
   "source": {
    "doc": "rules",
    "page": 63,
    "label": "伍-31",
    "program": 122
   }
  },
  {
   "id": "26904_D1402",
   "name": "外因(V~Y)死亡/失能退保別應為意外類",
   "category": "跨檔",
   "level": "跨檔",
   "severity": "error",
   "file": "D",
   "ref": "D1402",
   "source": {
    "doc": "rules",
    "page": 60,
    "label": "伍-28",
    "program": 116
   }
  },
  {
   "id": "X001",
   "name": "臺幣保單原幣金額應等於臺幣金額",
   "category": "邏輯合理性",
   "level": "邏輯合理性",
   "severity": "warning",
   "file": "L/D",
   "ref": "本工具補充",
   "source": {
    "doc": "tool",
    "note": "本工具補充的合理性檢查，手冊無對應條文"
   }
  },
  {
   "id": "X002",
   "name": "投保年齡合理範圍 (0~100 歲)",
   "category": "邏輯合理性",
   "level": "邏輯合理性",
   "severity": "warning",
   "file": "L/D",
   "ref": "本工具補充",
   "source": {
    "doc": "tool",
    "note": "本工具補充的合理性檢查，手冊無對應條文"
   }
  },
  {
   "id": "X003",
   "name": "保額異常偏高 (> 新臺幣 5 億)",
   "category": "邏輯合理性",
   "level": "邏輯合理性",
   "severity": "warning",
   "file": "L/D",
   "ref": "本工具補充",
   "source": {
    "doc": "tool",
    "note": "本工具補充的合理性檢查，手冊無對應條文"
   }
  },
  {
   "id": "X004",
   "name": "應繳總保費不應大於保額 3 倍 (非躉繳)",
   "category": "邏輯合理性",
   "level": "邏輯合理性",
   "severity": "warning",
   "file": "L/D",
   "ref": "本工具補充",
   "source": {
    "doc": "tool",
    "note": "本工具補充的合理性檢查，手冊無對應條文"
   }
  }
 ],
 "toolRules": [
  {
   "id": "C001",
   "name": "身分證／居留證號碼檢查碼",
   "category": "主檔交叉比對",
   "severity": "error",
   "file": "客戶資料",
   "ref": "客戶資料",
   "source": {
    "doc": "tool",
    "note": "客戶／商品主檔與承保檔交叉比對 (本工具)"
   }
  },
  {
   "id": "C002",
   "name": "性別與證號第 2 碼一致",
   "category": "主檔交叉比對",
   "severity": "error",
   "file": "客戶資料",
   "ref": "客戶資料",
   "source": {
    "doc": "tool",
    "note": "客戶／商品主檔與承保檔交叉比對 (本工具)"
   }
  },
  {
   "id": "C003",
   "name": "出生日期合法",
   "category": "主檔交叉比對",
   "severity": "error",
   "file": "客戶資料",
   "ref": "客戶資料",
   "source": {
    "doc": "tool",
    "note": "客戶／商品主檔與承保檔交叉比對 (本工具)"
   }
  },
  {
   "id": "C004",
   "name": "郵遞區號與地址一致",
   "category": "主檔交叉比對",
   "severity": "error",
   "file": "客戶資料",
   "ref": "客戶資料",
   "source": {
    "doc": "tool",
    "note": "客戶／商品主檔與承保檔交叉比對 (本工具)"
   }
  },
  {
   "id": "C005",
   "name": "同一證號之姓名、出生日期、性別一致",
   "category": "主檔交叉比對",
   "severity": "error",
   "file": "客戶資料",
   "ref": "客戶資料",
   "source": {
    "doc": "tool",
    "note": "客戶／商品主檔與承保檔交叉比對 (本工具)"
   }
  },
  {
   "id": "C006",
   "name": "承保保單須有要保人與被保險人資料",
   "category": "主檔交叉比對",
   "severity": "error",
   "file": "客戶資料",
   "ref": "客戶資料",
   "source": {
    "doc": "tool",
    "note": "客戶／商品主檔與承保檔交叉比對 (本工具)"
   }
  },
  {
   "id": "C007",
   "name": "客戶資料之保單須存在於承保檔",
   "category": "主檔交叉比對",
   "severity": "error",
   "file": "客戶資料",
   "ref": "客戶資料",
   "source": {
    "doc": "tool",
    "note": "客戶／商品主檔與承保檔交叉比對 (本工具)"
   }
  },
  {
   "id": "C008",
   "name": "被保險人出生日期、性別與承保檔一致",
   "category": "主檔交叉比對",
   "severity": "error",
   "file": "客戶資料",
   "ref": "客戶資料",
   "source": {
    "doc": "tool",
    "note": "客戶／商品主檔與承保檔交叉比對 (本工具)"
   }
  },
  {
   "id": "C009",
   "name": "被保險人身份與要保人關係一致",
   "category": "主檔交叉比對",
   "severity": "error",
   "file": "客戶資料",
   "ref": "客戶資料",
   "source": {
    "doc": "tool",
    "note": "客戶／商品主檔與承保檔交叉比對 (本工具)"
   }
  },
  {
   "id": "PM01",
   "name": "商品代號存在於商品資料",
   "category": "主檔交叉比對",
   "severity": "error",
   "file": "商品資料",
   "ref": "商品資料",
   "source": {
    "doc": "tool",
    "note": "客戶／商品主檔與承保檔交叉比對 (本工具)"
   }
  },
  {
   "id": "PM02",
   "name": "起保日不晚於商品停售日（不使用已停售舊代號）",
   "category": "主檔交叉比對",
   "severity": "error",
   "file": "商品資料",
   "ref": "商品資料",
   "source": {
    "doc": "tool",
    "note": "客戶／商品主檔與承保檔交叉比對 (本工具)"
   }
  },
  {
   "id": "PM03",
   "name": "起保日不早於商品起售日",
   "category": "主檔交叉比對",
   "severity": "error",
   "file": "商品資料",
   "ref": "商品資料",
   "source": {
    "doc": "tool",
    "note": "客戶／商品主檔與承保檔交叉比對 (本工具)"
   }
  },
  {
   "id": "PM04",
   "name": "險種與保險商品類別編號一致",
   "category": "主檔交叉比對",
   "severity": "error",
   "file": "商品資料",
   "ref": "商品資料",
   "source": {
    "doc": "tool",
    "note": "客戶／商品主檔與承保檔交叉比對 (本工具)"
   }
  },
  {
   "id": "PM05",
   "name": "繳費期間與商品繳費年期一致",
   "category": "主檔交叉比對",
   "severity": "warning",
   "file": "商品資料",
   "ref": "商品資料",
   "source": {
    "doc": "tool",
    "note": "客戶／商品主檔與承保檔交叉比對 (本工具)"
   }
  },
  {
   "id": "PM06",
   "name": "商品資料本身一致",
   "category": "主檔交叉比對",
   "severity": "error",
   "file": "商品資料",
   "ref": "商品資料",
   "source": {
    "doc": "tool",
    "note": "客戶／商品主檔與承保檔交叉比對 (本工具)"
   }
  },
  {
   "id": "S001",
   "name": "科目代號不存在於會計科目表",
   "category": "財報勾稽",
   "severity": "error",
   "file": "資產負債表",
   "ref": "會計科目表",
   "source": {
    "doc": "tool",
    "note": "會計科目表與對帳規則為示範用 (本工具)"
   }
  },
  {
   "id": "S002",
   "name": "使用已停用之舊科目代號",
   "category": "財報勾稽",
   "severity": "error",
   "file": "資產負債表",
   "ref": "會計科目表 (停用日/替代科目)",
   "source": {
    "doc": "tool",
    "note": "會計科目表與對帳規則為示範用 (本工具)"
   }
  },
  {
   "id": "S003",
   "name": "期初餘額 + 本期增加 − 本期減少 = 期末餘額",
   "category": "財報勾稽",
   "severity": "error",
   "file": "資產負債表",
   "ref": "餘額結轉",
   "source": {
    "doc": "tool",
    "note": "會計科目表與對帳規則為示範用 (本工具)"
   }
  },
  {
   "id": "S004",
   "name": "上層科目 = 下層科目合計",
   "category": "財報勾稽",
   "severity": "error",
   "file": "資產負債表",
   "ref": "科目層級加總",
   "source": {
    "doc": "tool",
    "note": "會計科目表與對帳規則為示範用 (本工具)"
   }
  },
  {
   "id": "S005",
   "name": "資產總計 = 負債總計 + 權益總計",
   "category": "財報勾稽",
   "severity": "error",
   "file": "資產負債表",
   "ref": "資產負債表平衡",
   "source": {
    "doc": "tool",
    "note": "會計科目表與對帳規則為示範用 (本工具)"
   }
  },
  {
   "id": "S006",
   "name": "科目代號重複",
   "category": "財報勾稽",
   "severity": "error",
   "file": "資產負債表",
   "ref": "會計科目表",
   "source": {
    "doc": "tool",
    "note": "會計科目表與對帳規則為示範用 (本工具)"
   }
  },
  {
   "id": "S007",
   "name": "科目名稱與科目表不一致",
   "category": "財報勾稽",
   "severity": "warning",
   "file": "資產負債表",
   "ref": "會計科目表",
   "source": {
    "doc": "tool",
    "note": "會計科目表與對帳規則為示範用 (本工具)"
   }
  },
  {
   "id": "S008",
   "name": "應付保險給付本期減少 = 給付明細實際給付合計",
   "category": "財報勾稽",
   "severity": "error",
   "file": "資產負債表",
   "ref": "財報與申報明細勾稽",
   "source": {
    "doc": "tool",
    "note": "會計科目表與對帳規則為示範用 (本工具)"
   }
  },
  {
   "id": "S009",
   "name": "金額欄位格式",
   "category": "財報勾稽",
   "severity": "error",
   "file": "資產負債表",
   "ref": "數值欄位",
   "source": {
    "doc": "tool",
    "note": "會計科目表與對帳規則為示範用 (本工具)"
   }
  },
  {
   "id": "R001",
   "name": "上游系統控制總數 = 申報明細彙總",
   "category": "跨系統對帳",
   "severity": "error",
   "file": "控制總數",
   "ref": "控制總數",
   "source": {
    "doc": "tool",
    "note": "會計科目表與對帳規則為示範用 (本工具)"
   }
  },
  {
   "id": "P001",
   "name": "上年度期末有效保單，本年度無資料 (漏報)",
   "category": "期初期末結轉",
   "severity": "error",
   "file": "上年度承保資料",
   "ref": "上年度申報檔",
   "source": {
    "doc": "tool",
    "note": "會計科目表與對帳規則為示範用 (本工具)"
   }
  },
  {
   "id": "P002",
   "name": "本年度期初有效 (XED)，但上年度期末非有效保單",
   "category": "期初期末結轉",
   "severity": "error",
   "file": "上年度承保資料",
   "ref": "上年度申報檔",
   "source": {
    "doc": "tool",
    "note": "會計科目表與對帳規則為示範用 (本工具)"
   }
  },
  {
   "id": "P003",
   "name": "本年度期初保額 = 上年度期末保額",
   "category": "期初期末結轉",
   "severity": "error",
   "file": "上年度承保資料",
   "ref": "上年度申報檔",
   "source": {
    "doc": "tool",
    "note": "會計科目表與對帳規則為示範用 (本工具)"
   }
  },
  {
   "id": "P004",
   "name": "保額變動須有對應之保額異動 (INN/DNN/PAU/ROL/CTC)",
   "category": "期初期末結轉",
   "severity": "error",
   "file": "上年度承保資料",
   "ref": "保額結轉",
   "source": {
    "doc": "tool",
    "note": "會計科目表與對帳規則為示範用 (本工具)"
   }
  },
  {
   "id": "A001",
   "name": "新契約投保年齡超過 80 歲",
   "category": "合理性（疑似異常）",
   "severity": "suspect",
   "file": "L",
   "ref": "合理性：投保年齡",
   "source": {
    "doc": "tool",
    "note": "疑似異常，需人工判斷 (本工具)"
   }
  },
  {
   "id": "A002",
   "name": "保額/總保費比與同商品中位數相差 5 倍以上",
   "category": "合理性（疑似異常）",
   "severity": "suspect",
   "file": "L",
   "ref": "合理性：統計離群 (中位數比)",
   "source": {
    "doc": "tool",
    "note": "疑似異常，需人工判斷 (本工具)"
   }
  },
  {
   "id": "A003",
   "name": "生效後 180 天內身故/失能/末期給付",
   "category": "合理性（疑似異常）",
   "severity": "suspect",
   "file": "D",
   "ref": "合理性：早期理賠",
   "source": {
    "doc": "tool",
    "note": "疑似異常，需人工判斷 (本工具)"
   }
  },
  {
   "id": "A004",
   "name": "同一被保險人 365 天內多次身故/失能/末期給付",
   "category": "合理性（疑似異常）",
   "severity": "suspect",
   "file": "D",
   "ref": "合理性：短期多次理賠",
   "source": {
    "doc": "tool",
    "note": "疑似異常，需人工判斷 (本工具)"
   }
  }
 ]
});
