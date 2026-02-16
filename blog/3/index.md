# エフェクトハンドラによる図形描画

@[](https://github.com/season1618/graph-effect)

## 座標変換
ディスプレイのピクセルが縦横に並んでいることから最終的な描画命令は直交座標で指定しなければならない。しかしながら、ユーザとしては画面上に勝手な座標系を貼り付けて、その座標系の下で図形を指示したい。Canvas APIなどには`translate`や`rotate`といった座標変換を行う関数が用意されているが、これらはキャンバスの状態を変更するため、元の座標系を取り戻すには毎回逆変換を挟むか`save`/`restore`でキャンバスの状態を管理する必要がある。したがって座標系を貼り付けるという静的・宣言的な見方にはそぐわない。

そこで図形をエフェクト、座標変換をハンドラとして実装する。ここではOCaml5.2を用いる。点・直線・円を描画するエフェクトは

```ocaml
type _ Effect.t
  += Point : float * float -> unit t
   | Line  : (float * float) * float -> unit t (* ((a, b), c) means ax + by = c *)
   | Circle: (float * float) * float -> unit t
   | LineSeg :  (float * float) * (float * float) -> unit t

let point (x, y) = perform (Point (x, y))
let line (a, b) c = perform (Line ((a, b), c))
let circle (a, b) r = perform (Circle ((a, b), r))
..
```

描画のためのハンドラは

```ocaml
let render (width, height) body =
  try_with body ()
  { effc = fun (type a) (eff: a t) ->
    match eff with
    | Point (x, y) -> Some (fun (k: (a, _) continuation) ->
        plot (int_of_float x) (int_of_float y);
        continue k ())
    | Line ((a, b), c) -> Some (fun (k: (a, _) continuation) ->
        let (x, y) = (width, height) in
        let diff_sign a b = a <= 0. && 0. < b || b <= 0. && 0. < a in
        let (o, p, q, r) = (-. c, a *. x -. c, a *. x +. b *. y -. c, b *. y -. c) in
        let ps = ref [] in
        if diff_sign o p then ps := (            c /. a,                 0.) :: !ps;
        if diff_sign p q then ps := (                 x, (c -. a *. x) /. b) :: !ps;
        if diff_sign q r then ps := ((c -. b *. y) /. a,                  y) :: !ps;
        if diff_sign r o then ps := (                0.,             c /. b) :: !ps;
        (match !ps with
        | p1 :: p2 :: _ -> draw_poly_line [|cast p1; cast p2|]
        | _ -> ());
        continue k ())
    | Circle (p, r) -> Some (fun (k: (a, _) continuation) ->
        let (x, y) = cast p in
        draw_circle x y (int_of_float r);
        continue k ())
    | LineSeg (p1, p2) -> Some (fun (k: (a, _) continuation) ->
        draw_poly_line [|cast p1; cast p2|];
        continue k ())
    | _ -> None
  }
```

となる。

座標変換としてまず相似変換(平行移動・回転・拡大縮小)を考える。座標変換はハンドラの中で再びエフェクトを発生させる形になる。例えば平行移動のハンドラは以下のようになる。

```ocaml
let translate dp =
  { effc = fun (type a) (eff: a t) ->
    match eff with
    | Point (x, y) -> Some (fun (k: (a, _) continuation) ->
        let (x', y') = translate dp (x, y) in
        continue k (perform (Point (x', y'))))
    | Line ((a, b), c) -> Some (fun (k: (a, _) continuation) ->
        let (dx, dy) = dp in
        continue k (perform (Line ((a, b), a *. dx +. b *. dy +. c))))
    | Circle (p, r) -> Some (fun (k: (a, _) continuation) ->
        continue k (perform (Circle (translate dp p, r))))
    | LineSeg (p1, p2) -> Some (fun (k: (a, _) continuation) ->
        continue k (perform (LineSeg (translate dp p1, translate dp p2))))
    | _ -> None
  }
```

回転や拡大縮小についても同様。

どのような座標系に置かれているか分かりやすいように

```ocaml
let handle handler body =
  fun () -> try_with body () handler
```

とおくと、

```ocaml
render_at_center (width, height) @@
  handle (rotate (Float.pi /. 4.)) @@
    handle (scale 200.0)
      (fun () ->
        line ( 1.,  0.) 2.;
        line (-1.,  0.) 2.;
        line ( 0.,  1.) 2.;
        line ( 0., -1.) 2.;
        circle0 0.5;
        triangle (1., 0.) (-1. /. 2., sqrt 3. /. 2.) (-1. /. 2., -. sqrt 3. /. 2.);
        rectangle (-1., -1.) (1., 1.)
      );
```

@[](./example.png)

のように書ける(`render_at_center (width, height)`は原点をウィンドウ中心に平行移動して描画するハンドラ)。

もう少し非自明な変換として[反転(inversion)](https://ja.wikipedia.org/wiki/%E5%8F%8D%E8%BB%A2%E5%B9%BE%E4%BD%95%E5%AD%A6)がある。反転とは、平面上の点をある点から見て方向は同じで距離が逆数の位置に写す変換である。反転は円を円に写す(直線は半径無限大の円と見なす)ことが知られており、以下のようにハンドラを定義できる。

```ocaml
let inversion =
  { effc = fun (type a) (eff: a t) ->
    match eff with
    | Point (x, y) -> Some (fun (k: (a, _) continuation) ->
        let r2 = x ** 2. +. y ** 2. in
        continue k (perform (Point (x /. r2, y /. r2))))
    | Line ((a, b), c) -> Some (fun (k: (a, _) continuation) ->
        if c = 0.
          then continue k (perform (Line ((a, b), c)))
          else let (a, b) = (a /. (2. *. c), b /. (2. *. c)) in
               let r = sqrt (a ** 2. +. b ** 2.) in
               continue k (perform (Circle ((a, b), r))))
    | Circle ((a, b), r) -> Some (fun (k: (a, _) continuation) ->
        let d = a ** 2. +. b ** 2. -. r ** 2. in
        if d = 0.
          then continue k (perform (Line ((2. *. a, 2. *. b), 1.)))
          else continue k (perform (Circle ((a /. d, b /. d), r /. Float.abs d))))
    | _ -> None
  }
```

反転を用いるとシュタイナー円鎖やパップス円鎖などの図形を簡単に描画できる[^反転の中心を上手く選ぶと同心円(平行な二直線)に接する同じ大きさの円に変換できる]。

@[シュタイナー円鎖](./steiner-chain.png)
@[パップス円鎖](./pappus-chain.png)

## フラクタル
再帰的図形を再帰関数によって(解像度の限界を指定することなく)定義したいとする。再帰呼び出しはDFS順に発生するから図形の一部を描画するのに無限の時間がかかり全体の様子を捉えることができない。そこで、関数呼び出しのタイミングでエフェクトを発生させ、ハンドラの方でBFS順つまり解像度の粗い方から順に描画されるようスケジューリングする。

`Call`エフェクトを以下のように定義する。
```ocaml
type _ Effect.t
  += Call : ('a -> unit -> unit) * 'a -> (unit -> unit) t

let call f arg = perform (Call (f, arg))
```
エフェクトが発生したとき、関数呼び出しを行うタスクをキューに追加し、継続には何もしない処理`fun () -> ()`を渡して再帰せずに処理を続行する(`effc`)。現状の呼び出しで発生する`Call`エフェクトが全てハンドルされたところでvalue handlerが呼び出され、キューからタスクを取り出して関数呼び出しを行う(`retc`)。
```ocaml
let make_bfs_without_cont () : (unit -> unit) -> unit -> unit =
  let tasks = Queue.create () in
  let enqueue task = Queue.push task tasks in
  let dequeue () = Queue.take_opt tasks in
  let rec bfs =
    { retc = (fun () ->
        match dequeue () with
        | None -> ()
        | Some task -> task ()
        );
      exnc = ..;
      effc = fun (type a) (eff : a t) ->
        match eff with
        | Call (f, arg) -> Some (fun (k : (a, unit) continuation) ->
            enqueue (f arg);
            spawn (fun () -> continue k (fun () -> ())) ()
            )
        | _ -> None
    }
  and spawn (f : unit -> unit) : unit -> unit = fun () -> match_with f () bfs in
  spawn
```

例えばシェルピンスキーのギャスケットは以下のように各再帰呼び出しで`call`を挿入すれば良い。
```ocaml
let rec sierpinski_gasket (a, b, c) () =
  triangle a b c;
  let a' = mid b c in
  let b' = mid c a in
  let c' = mid a b in
  call sierpinski_gasket (a , b', c') ();
  call sierpinski_gasket (a', b , c') ();
  call sierpinski_gasket (a', b', c ) ()
```

```ocaml
let run_bfs = make_bfs_without_cont () in
render_at_center (width, height) @@
  handle (scale 300.0) @@
    run_bfs @@
      sierpinski_gasket ((0., 1.), (sqrt 3. /. 2., -1. /. 2.), (-. sqrt 3. /. 2., -1. /. 2.))
      ;
```

@[シェルピンスキーのギャスケット](./sierpinski-gasket.mp4)

初めに全体像が現れ徐々に細かい部分が描画されていることが分かる。

以上の例は自己相似な部分図形を変換せずにそのまま利用していた。部分図形を座標変換した上で組み合わせるには、その部分図形が置かれている座標系(つまりその関数呼び出しの継続)を持っておく必要がある。タスクキューにはタスクと共に継続を追加し、実行するときはその継続の元で実行するよう修正すると以下のようになる[^OCamlの継続はワンショットなので明示的に複製する必要がある。各呼び出しで複製される継続のサイズは再帰の深さに比例するため効率は悪い。]。

```ocaml
let make_bfs () : (unit -> unit) -> unit -> unit =
  let tasks = Queue.create () in
  let enqueue task = Queue.push task tasks in
  let dequeue () = Queue.take_opt tasks in
  let rec bfs =
    { retc = (fun () ->
        match dequeue () with
        | None -> ()
        | Some (Task (task, k)) -> continue k task
        );
      exnc = ..;
      effc = fun (type a) (eff : a t) ->
        match eff with
        | Call (f, arg) -> Some (fun (k : (a, unit) continuation) ->
            let k' = clone_continuation k in
            enqueue (Task (f arg, k'));
            spawn (fun () -> continue k (fun () -> ())) ()
            )
        | _ -> None
    }
  and spawn (f : unit -> unit) : unit -> unit = fun () -> match_with f () bfs in
  spawn
```

これを用いると[ピタゴラスの木](https://ja.wikipedia.org/wiki/%E3%83%94%E3%82%BF%E3%82%B4%E3%83%A9%E3%82%B9%E3%81%AE%E6%9C%A8)は以下のように書ける。

```ocaml
let rec pythagoras_tree (a, b, c) () =
  rectangle (-. c /. 2., -. c /. 2.) (c /. 2., c /. 2.);
  let m = (a +. b) /. 2. in
  (handle (translate (-. m *. b /. c, m *. a /. c +. c /. 2.)) @@
    handle (rotate (acos (a /. c))) @@
      handle (scale (a /. c)) @@
        call pythagoras_tree (a, b, c)
  ) ();
  (handle (translate (m *. a /. c, m *. b /. c +. c /. 2.)) @@
    handle (rotate (-. acos (b /. c))) @@
      handle (scale (b /. c)) @@
        call pythagoras_tree (a, b, c)
  ) ()
```

```ocaml
let run_bfs = make_bfs () in
render_at_center (width, height) @@
  handle (scale 30.0) @@
    handle (translate (0.0, -5.0)) @@
      run_bfs @@
        (pythagoras_tree (0, 3., 4., 5.))
        ;
```

@[ピタゴラスの木](./pythagoras-tree.mp4)
