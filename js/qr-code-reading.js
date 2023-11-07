const TEXT_LIST = [
  "Apple", "Microsoft", "	Amazon.com", "NVIDIA", "Alphabet A",
  "Alphabet C", "Meta Platforms A", "Tesla", "Eli Lilly", "UnitedHealth Group"
]

const EditMode = {
  FinderPattern: Symbol("FinderPattern"),
  TimingPattern: Symbol("TimingPattern"),
  Information: Symbol("Information"),
  Mask: Symbol("Mask"),
  VersionInformation: Symbol("VersionInformation"),
};

const QRCodeVersion = [-1,
  21, 25, 29, 33, 37,
  41, 45, 49, 53, 57,
  61, 65, 69, 73, 77,
  81, 85, 89, 93, 97,
  101, 105, 109, 113, 117,
  121, 125, 129, 133, 137,
  141, 145, 149, 153, 157,
  161, 165, 169, 173, 177]


const QRCodeColor = {
  Normal: ["rgb(255, 255, 255)", "rgb(0, 0, 0)"],
  FormatInformation: ["rgb(255, 249, 232)", "rgb(252, 205, 15)"],
  TimingPattern: ["rgb(68, 147, 249)", "rgb(236, 244, 255)"],
  VersionInformation: ["rgb(121, 255, 0)", "rgb(195, 255, 154)"],

  Create_Profile: (color) => {
    let color_profile = {};
    QRCodeColor.Normal.forEach((key, i) => color_profile[key] = color[i])
    return color_profile;
  }
}


const QRCodeGame = (UI, QRCode_id_name) => {
  let _correctText;
  function correctText() { return _correctText; };

  let QRCode_table = [], QRCode_table_mask = [];

  function clearQRcode() {
    UI.$QRCode.empty();
    UI.$QRCodeMask.empty();
  };

  function createQRcode(text, size) {
    clearQRcode();
    UI.$QRCode.qrcode({
      text: text,
      render: "table",
      width: size,
      height: size,
      // correctLevel: QRErrorCorrectLevel.H,
    });

    if (QRCode_table.length == 0) {
      QRCode_table = loadTable();
      QRCode_table = editHeaderQRcode(QRCode_table, [EditMode.FinderPattern]);
      QRCode_table_mask = JSON.parse(JSON.stringify(QRCode_table));
      QRCode_table_mask = editHeaderQRcode(QRCode_table_mask, [EditMode.TimingPattern, EditMode.Information, EditMode.VersionInformation, EditMode.Mask]);
    }

    QRCode_table.forEach(function (row, i) {
      row.forEach(function (color, j) {
        UI.$QRCode.find('tr').eq(i).children('td').eq(j).css("background-color", color);
      });
    });

    UI.$QRCodeMask.append(UI.$QRCode.children('table').clone());
    QRCode_table_mask.forEach(function (row, i) {
      row.forEach(function (color, j) {
        UI.$QRCodeMask.find('tr').eq(i).children('td').eq(j).css("background-color", color);
      });
    });
  }


  function GetFormatInformation(table) {
    let formatBinary = 0;
    for (let i = 1; i <= 7; i++) {
      formatBinary <<= 1;
      formatBinary += table[table.length - i][8] == QRCodeColor.Normal[1];
    }
    for (let i = 8; i > 0; i--) {
      formatBinary <<= 1;
      formatBinary += table[8][table[0].length - i] == QRCodeColor.Normal[1];
    }
    formatBinary ^= 0b101010000010010;

    let formatInformation = {
      ErrorCorrectionLevel: formatBinary >> 13,
      MaskPattern: (formatBinary >> 10) & 0b111,
      ErrorCorrectionCode: formatBinary & 0b1111111111,
    };
    return formatInformation;
  }

  /**
   * 指定サイズのマスクパターンを生成
   * @param {number} size 
   * @param {number} mask_pattern 
   * @returns boolean[size][size]
   */
  function createMaskPattern(size, mask_pattern) {
    function calcMaskPattern(y, x, mask_pattern) {
      switch (mask_pattern) {
        case 0: return (y + x) % 2 == 0;
        case 1: return y % 2 == 0;
        case 2: return x % 3 == 0;
        case 3: return (y + x) % 3 == 0;
        case 4: return (Math.floor(y / 2) + Math.floor(x / 3)) % 2 == 0;
        case 5: return (y * x) % 2 + (y * x) % 3 == 0;
        case 6: return ((y * x) % 2 + (y * x) % 3) % 2 == 0;
        case 7: return ((y * x) % 3 + (y * x) % 2) % 2 == 0;
        default: return false;
      }
    }

    let MaskPatternArray = Array(size).fill().map(() => Array(size).fill(false));
    for (let i = 0; i < MaskPatternArray.length; i++) {
      for (let j = 0; j < MaskPatternArray[0].length; j++) {
        MaskPatternArray[i][j] = calcMaskPattern(i, j, mask_pattern);
      }
    }

    MaskPatternArray = fillFinderPattern(MaskPatternArray, false);
    MaskPatternArray = fillTimingPattern(MaskPatternArray, [false, false]);
    MaskPatternArray = fillInformation(MaskPatternArray, { true: false, false: false });
    MaskPatternArray = fillVersionInformation(MaskPatternArray, 0, { true: false, false: false });
    return MaskPatternArray;
  }

  /**
   * QRコードの切り出しシンボル部分を塗りつぶしする
   * @param {array} table 
   * @param {any} fill_item 
   * @returns 
   */
  function fillFinderPattern(table, fill_item) {
    fillSevenField = (table, start_x, start_y) => {
      for (let y = 0; y < 8; y++) {
        for (let x = 0; x < 8; x++)
          table[start_y + y][start_x + x] = fill_item;
      }
      return table;
    };

    table = fillSevenField(table, 0, 0);//左上
    table = fillSevenField(table, 0, table.length - 8);//左下
    table = fillSevenField(table, table[0].length - 8, 0);//右上
    return table;
  }

  function fillTimingPattern(table, fill_item = [true, false]) {
    for (let i = 0; i < table.length - 8 * 2; i++) {
      table[i + 8][6] = table[6][i + 8] = fill_item[i % 2];
    }
    return table;
  }

  function fillInformation(table, filled_item = { true: true, false: false }) {
    for (let i = 0; i < 9; i++) {
      table[i][8] = KeyTransValue(table[i][8], filled_item);
      table[8][i] = KeyTransValue(table[8][i], filled_item);
    }
    for (let i = 0; i < 8; i++) {
      let Horizontal_x = table[0].length - 8 + i, Vertical_y = table.length - 8 + i;
      table[Vertical_y][8] = KeyTransValue(table[Vertical_y][8], filled_item);
      table[8][Horizontal_x] = KeyTransValue(table[8][Horizontal_x], filled_item);
    }
    return table;
  }

  function fillVersionInformation(table, version, convert_item = { true: true, false: false }) {
    if (version < 7) return table;

    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 6; j++) {
        table[table.length - 11 + i][j] = KeyTransValue(table[table.length - 11 + i][j], convert_item);
        table[j][table.length - 11 + i] = KeyTransValue(table[j][table.length - 11 + i], convert_item);
      }
    }
    return table;
  }

  function KeyTransValue(key, hash) {
    if (key in hash)
      return hash[key];
    return key;
  }

  /**
   * QRコードのヘッダ部の編集を行う
   * @param {array} QRCode_table 
   * @param {array:EditMode} fillFlag
   * @returns 
   */
  function editHeaderQRcode(QRCode_table, fillFlag = [EditMode.FinderPattern]) {
    let formatInformation = GetFormatInformation(QRCode_table);
    let version = QRCode_table.length / 4 - 17;
    // 切り出しシンボルの編集
    if (fillFlag.includes(EditMode.FinderPattern)) {
      QRCode_table = fillFinderPattern(QRCode_table, "rgb(68, 147, 249)");
    }

    // タイミングパターンの可視化
    if (fillFlag.includes(EditMode.TimingPattern)) {
      QRCode_table = fillTimingPattern(QRCode_table, QRCodeColor.TimingPattern);
    }

    // フォーマット情報の可視化
    if (fillFlag.includes(EditMode.Information)) {
      let color_profile = QRCodeColor.Create_Profile(QRCodeColor.FormatInformation);
      QRCode_table = fillInformation(QRCode_table, color_profile);
    }

    // マスク処理の復元
    if (fillFlag.includes(EditMode.Mask)) {
      let mask = createMaskPattern(QRCode_table.length, formatInformation.MaskPattern);
      for (let i = 0; i < mask.length; i++) {
        for (let j = 0; j < mask[0].length; j++) {
          if (mask[i][j]) {
            if (QRCode_table[i][j] == "rgb(0, 0, 0)")
              QRCode_table[i][j] = "rgb(255, 255, 255)";
            else
              QRCode_table[i][j] = "rgb(0, 0, 0)";
          }
        }
      }
    }

    // バージョン情報の可視化
    if (fillFlag.includes(EditMode.VersionInformation)) {
      let color_profile = QRCodeColor.Create_Profile(QRCodeColor.VersionInformation);
      QRCode_table = fillVersionInformation(QRCode_table, version, color_profile);
    }

    return QRCode_table;
  }

  function reViewQRcode() {
    createQRcode(_correctText, UI.$QRCodeSize.val());
  }

  function loadTable() {
    let table = [];
    UI.$QRCode.find('tr').each(function () {
      let row = [];
      $(this).children('td').each(function () {
        row.push($(this).css("background-color"));
      });
      table.push(row);
    });
    return table;
  }

  function setSelectButton(correctText) {
    UI.$QRCodeAnswerSelect.empty();
    UI.$QRCodeAnswerButton.prop("disabled", false);

    let setText = [correctText];
    for (i = 0; i < 4; i++) {
      let text = TEXT_LIST[Math.floor(Math.random() * TEXT_LIST.length)];
      while (setText.includes(text) || text == correctText) {
        text = TEXT_LIST[Math.floor(Math.random() * TEXT_LIST.length)];
      }
      setText.push(text);
    }

    for (let i = 0; i < 3; i++) {
      setText = shuffleArray(setText);
    }

    setText.forEach(function (text, i) {
      // $('#qr-answer-select').append(`<button type="button" class="btn btn-outline-primary btn-lg answer_button" value="${text}">${text}</button>`);
      UI.$QRCodeAnswerSelect.append(`<input type="radio" name="answer_button" class="btn-check" autocomplete="off" id="answer_button${i}" value="${text}"> <label for="answer_button${i}" class="btn btn-outline-primary answer_button"> ${text}</label>`);
    });
  }

  function Init() {
    _correctText = TEXT_LIST[Math.floor(Math.random() * TEXT_LIST.length)];
    let size = UI.$QRCodeSize.val();
    createQRcode(_correctText, size);
    setSelectButton(_correctText);
  }
  return { Init, reViewQRcode, correctText };
}

const UI = {
  $QRCode: $('#op-qrcode'),
  $QRCodeMask: $('#op-qrcode-mask'),
  $QRCodeSize: $('#qr-size'),
  $QRCodeAnswer: $('#qr-answer'),
  $QRCodeAnswerSelect: $('#qr-answer-select'),
  $QRCodeAnswerButton: $('#guess_button'),

};

let game = QRCodeGame(UI, "#op-qrcode");
game.Init();

function shuffleArray(array) {
  const cloneArray = [...array]
  for (let i = cloneArray.length - 1; i >= 0; i--) {
    const rand = Math.floor(Math.random() * (i + 1));
    [cloneArray[i], cloneArray[rand]] = [cloneArray[rand], cloneArray[i]]
  }
  return cloneArray
}

const sleep = waitTime => new Promise(resolve => setTimeout(resolve, waitTime));

UI.$QRCodeSize.on('change', function () {
  game.reViewQRcode();
});



UI.$QRCodeAnswer.on('click', '#guess_button', async function () {
  let answer = $('input:radio[name="answer_button"]:checked').val();
  if (answer == undefined) return;
  $(this).prop("disabled", true);
  answer == game.correctText() ? alert("正解!\nThat is correct!") : alert("不正解\nThat is not correct." + game.correctText());
  await sleep(1000);
  game.Init();
});
