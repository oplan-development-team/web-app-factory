
### [14:35:00] prototype-builder（初回実装） — shot-splice-darkroomを暗室スタイルで実装、visual-qaでCSS specificityバグ2件を発見・修正
- 結果: apps/shot-splice-darkroom/にVite+TypeScript(vanilla)でスクリーンショット継ぎ足しツールを実装。重なり自動検出は自前の2段階探索(粗解像度→周辺再探索)、暗室・アナログ現像室スタイル(赤セーフライト基調、Oswald/Space Mono/Caveatの3書体使い分け)。npm run build・docker build/run・Playwright実機操作(合成/自動位置合わせ/差分確認/PNG書き出し/375-1440幅)まで確認済み。
- 気づき: visual-qaのCSS specificity監査で実装バグを2件発見。`.tray__preview`/`.lighttable__empty`/`.lighttable__status`いずれも、`class{display:...}`と`[hidden]{display:none}`が同じ詳細度(0,0,1,0)のため、後勝ちのclass側が[hidden]を上書きし「hidden属性を立てても消えない」状態になっていた。`.xxx[hidden]{display:none}`の明示的な上書きルールを追加して解消。同種のバグは他アプリでも起きうるため、hidden属性とクラスベースのdisplay指定を併用する箇所は要注意。
- 気づき: 読み込み中オーバーレイ(data-status)にテキストコンテンツを入れ忘れていたのもvisual-qaで発覚(「現像中…」ラベルが無く、パルスドットだけの空のオーバーレイになっていた)。体験品質チェックリストの「ローディング状態」項目は、表示/非表示切り替えロジックだけでなく中身のテキストまで実際にレンダーして確認する必要がある。
