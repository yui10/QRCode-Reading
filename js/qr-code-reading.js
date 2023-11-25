let TEXT_LIST = [
  "Apple", "Microsoft", "Amazon.com", "NVIDIA", "Alphabet A",
  "Alphabet C", "Meta Platforms A", "Tesla", "Eli Lilly", "UnitedHealth Group"
]

/** QRコードの編集モード */
const EditMode = {
  FinderPattern: Symbol("FinderPattern"),
  TimingPattern: Symbol("TimingPattern"),
  Information: Symbol("Information"),
  Mask: Symbol("Mask"),
  VersionInformation: Symbol("VersionInformation"),
};

/** QRコードのバージョンとサイズの対応表 */
const QRCodeVersion = [-1,
  21, 25, 29, 33, 37,
  41, 45, 49, 53, 57,
  61, 65, 69, 73, 77,
  81, 85, 89, 93, 97,
  101, 105, 109, 113, 117,
  121, 125, 129, 133, 137,
  141, 145, 149, 153, 157,
  161, 165, 169, 173, 177]


/** 各編集に使用される色コード */
const QRCodeColor = {
  Normal: ["rgb(255, 255, 255)", "rgb(0, 0, 0)"],
  FormatInformation: ["rgb(255, 249, 232)", "rgb(252, 205, 15)"],
  TimingPattern: ["rgb(68, 147, 249)", "rgb(236, 244, 255)"],
  VersionInformation: ["rgb(121, 255, 0)", "rgb(195, 255, 154)"],

  /**
   * Key:引数の色コード, Value:変更後の色コードの連想配列を作成する
   * @param {array} color
   * @returns 
   */
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

  /**
   * QRコードの描画をクリアする
   */
  function clearQRcode() {
    UI.$QRCode.empty();
    UI.$QRCodeMask.empty();
  };

  /**
   * QRコードを生成し、編集を行う
   * @param {string} text 
   * @param {number} size 
   */
  function createQRcode(text, size) {
    clearQRcode();
    text = Encoding.convert(text, 'sjis');
    // QRコードの描画
    UI.$QRCode.qrcode({
      text: text,
      render: "table",
      width: size,
      height: size,
      // correctLevel: QRErrorCorrectLevel.H,
    });

    // QRコードの編集後キャッシュがない場合は作成する
    if (QRCode_table.length == 0) {
      QRCode_table = loadTable();
      // ファインダーパターンを塗りつぶす
      QRCode_table = editHeaderQRcode(QRCode_table, [EditMode.FinderPattern]);
      // マスク処理などの編集を行ったQRコードを生成
      QRCode_table_mask = JSON.parse(JSON.stringify(QRCode_table));
      QRCode_table_mask = editHeaderQRcode(QRCode_table_mask, [EditMode.TimingPattern, EditMode.Information, EditMode.VersionInformation, EditMode.Mask]);
    }

    // ファインダーパターンを塗りつぶしたQRコードの描画
    QRCode_table.forEach(function (row, i) {
      row.forEach(function (color, j) {
        UI.$QRCode.find('tr').eq(i).children('td').eq(j).css("background-color", color);
      });
    });

    // マスク処理などの編集を行ったQRコードの描画
    UI.$QRCodeMask.append(UI.$QRCode.children('table').clone());
    QRCode_table_mask.forEach(function (row, i) {
      row.forEach(function (color, j) {
        UI.$QRCodeMask.find('tr').eq(i).children('td').eq(j).css("background-color", color);
      });
    });
  }


  /**
   * QRコードのフォーマット情報を取得
   * @param {array} table 
   * @returns {any} {ErrorCorrectionLevel, MaskPattern, ErrorCorrectionCode}を返す
   */
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
   * @returns {array[]}マスクパターンに対応した boolean[size][size] を返す
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
    // マスクパターンの生成
    let MaskPatternArray = Array(size).fill().map(() => Array(size).fill(false));
    for (let i = 0; i < MaskPatternArray.length; i++) {
      for (let j = 0; j < MaskPatternArray[0].length; j++) {
        MaskPatternArray[i][j] = calcMaskPattern(i, j, mask_pattern);
      }
    }

    // 各種情報部をfalseにする
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

  /**
   * タイミングパターン部を塗る
   * @param {array} table 
   * @param {array} fill_item 黒;true, 白:falseの場合[true, false]となる
   * @returns 
   */
  function fillTimingPattern(table, fill_item = [true, false]) {
    for (let i = 0; i < table.length - 8 * 2; i++) {
      table[i + 8][6] = table[6][i + 8] = fill_item[i % 2];
    }
    return table;
  }

  /**
   *  フォーマット情報部を塗る
   * @param {array} table 
   * @param {array} filled_item 
   * @returns 
   */
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

  /**
   * バージョン情報部を塗る
   * @param {array} table 
   * @param {number} version QRコードのバージョン
   * @param {array} convert_item KeyをValueに変化するための連想配列
   * @returns 
   */
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

  /**
   * 連想配列からkeyの値を取得する。みつからない場合はkeyをそのまま返す。
   * @param {any} key 検索するキー
   * @param {array} hash 連想配列
   * @returns {any} keyに対応する値を返す。みつからない場合はkeyをそのまま返す。
   */
  function KeyTransValue(key, hash) {
    if (key in hash)
      return hash[key];
    return key;
  }

  /**
   * QRコードのヘッダ部の編集を行う
   * @param {array} QRCode_table 
   * @param {array} fillFlag EditModeを指定する配列
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

  /**
   * QRコードの描画を再度行う.正解のテキストは同じだが、サイズは変更される.
   */
  function reViewQRcode() {
    createQRcode(_correctText, UI.$QRCodeSize.val());
  }

  /**
   * HTMLで描画されたQRコードの色情報を取得する
   * @returns {array} QRコードの色情報を返す
   */
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

  /**
   * 選択肢のボタンを作成する
   * @param {string} correctText 正解のテキスト
   */
  function setSelectButton(correctText) {
    UI.$QRCodeAnswerSelect.empty();
    UI.$QRCodeAnswerButton.prop("disabled", false);

    // 選択肢をランダムで選択
    let setText = [correctText];
    for (i = 0; i < 4; i++) {
      let text = TEXT_LIST[Math.floor(Math.random() * TEXT_LIST.length)];
      while (setText.includes(text) || text == correctText) {
        text = TEXT_LIST[Math.floor(Math.random() * TEXT_LIST.length)];
      }
      setText.push(text);
    }

    // 選択肢をシャッフル
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
    QRCode_table = [], QRCode_table_mask = [];
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
const one_day = 1000 * 60 * 60 * 24;
let timer = Timer(1000, () => {
  let time = new Date(timer.Time());
  if (time > one_day) {
    timer.Stop();
    alert("時間切れです\nTime is up.");
    GameStart();
  }
  $('.timer').text(time.toISOString().slice(11, 19));
});

function GameStart() {
  game.Init();
  $('.timer').text("00:00:00");
  timer.ReStart();
}

let country = country_code().fetchCountryList(LANG.JA);
const fetchFunction = () => {
  if (Object.keys(country).length == 0)
    setTimeout(fetchFunction, 500);
  else {
    TEXT_LIST = []
    for (let i = 0; i < Object.keys(country).length; i++) {
      TEXT_LIST.push(country[i]["name"])
    }

    GameStart();
  }
};
setTimeout(fetchFunction, 1000);

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
  timer.Stop();
  let time = new Date(timer.Time()).toISOString().slice(11, 19);
  answer == game.correctText() ? alert(`正解!\nThat is correct!\nClear Time : ${time}`) : alert(`不正解\nThat is not correct. ${game.correctText()}`);
  await sleep(1000);
  GameStart();
});
