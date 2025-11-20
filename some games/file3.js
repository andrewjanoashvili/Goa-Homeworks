// Minimal Tetris implementation (file3.js)
(() => {
  const COLS = 10; const ROWS = 20; const BLOCK = 24; // block/pixel size
  const canvas = document.getElementById('board');
  const ctx = canvas.getContext('2d');
  const nextCanvas = document.getElementById('next');
  const nctx = nextCanvas.getContext('2d');
  canvas.width = COLS * BLOCK; canvas.height = ROWS * BLOCK;
  const colors = [null,'#f43f5e','#f59e0b','#10b981','#60a5fa','#a78bfa','#f97316','#ef4444'];

  // Tetromino shapes (rotations are handled by matrix rotation)
  const SHAPES = {
    I: [[1,1,1,1]],
    J: [[2,0,0],[2,2,2]],
    L: [[0,0,3],[3,3,3]],
    O: [[4,4],[4,4]],
    S: [[0,5,5],[5,5,0]],
    T: [[0,6,0],[6,6,6]],
    Z: [[7,7,0],[0,7,7]]
  };
  const keys = {left:37,up:38,right:39,down:40,space:32,x:88,p:80};

  function createMatrix(w,h){ const m=[]; while(h--) m.push(new Array(w).fill(0)); return m; }
  function rotate(matrix){ // clockwise
    const n = matrix.length, m = matrix[0].length; const res = [];
    for(let x=0;x<m;x++){ res[x]=[]; for(let y=n-1;y>=0;y--){ res[x].push(matrix[y][x]); } }
    return res;
  }

  function drawMatrix(matrix, offset, context, scale=BLOCK){
    context.clearRect(0,0, context.canvas.width, context.canvas.height);
    for(let y=0;y<matrix.length;y++){
      for(let x=0;x<matrix[y].length;x++){
        const val = matrix[y][x];
        if(val){ context.fillStyle = colors[val]; context.fillRect((x+offset.x)*scale, (y+offset.y)*scale, scale-1, scale-1); }
      }
    }
  }

  let board = createMatrix(COLS, ROWS);

  function collide(board, piece){
    const [m, pos] = [piece.matrix, piece.pos];
    for(let y=0;y<m.length;y++){
      for(let x=0;x<m[y].length;x++){
        if(m[y][x] && (board[y+pos.y] && board[y+pos.y][x+pos.x]) !== 0) return true;
      }
    }
    return false;
  }

  function merge(board, piece){
    piece.matrix.forEach((row,y)=>{ row.forEach((val,x)=>{ if(val) board[y+piece.pos.y][x+piece.pos.x] = val; }); });
  }

  function sweep(){
    let rowCount = 0; outer: for(let y=ROWS-1;y>=0;y--){
      for(let x=0;x<COLS;x++) if(board[y][x]===0) continue outer;
      const row = board.splice(y,1)[0].fill(0); board.unshift(row); y++; rowCount++;
    }
    return rowCount;
  }

  function createPiece(type){ return {matrix: SHAPES[type].map(r=>r.slice()), pos:{x:Math.floor((COLS - SHAPES[type][0].length)/2), y:0}, type}; }

  function randomPiece(){ const types = Object.keys(SHAPES); return createPiece(types[Math.floor(Math.random()*types.length)]); }

  let current = randomPiece(); let next = randomPiece();
  // make blocks fall a bit faster by default and speed up more when lines are cleared
  let dropCounter = 0, dropInterval = 500; let lastTime = 0; let score = 0, lines = 0; let paused=false; let gameOver=false;

  function reset(){ board = createMatrix(COLS, ROWS); current = randomPiece(); next = randomPiece(); score=0; lines=0; updateScore(); gameOver=false; dropInterval=500; }

  function updateScore(){ document.getElementById('score').textContent = score; document.getElementById('lines').textContent = lines; }

  function playerDrop(){ current.pos.y++; if(collide(board,current)){ current.pos.y--; merge(board,current); const cleared = sweep(); if(cleared){ lines += cleared; score += cleared * 100; /* speed up more per clear */ dropInterval = Math.max(80, dropInterval - cleared*50); } current = next; next = randomPiece(); if(collide(board,current)){ gameOver = true; } updateScore(); }
  }

  function playerMove(dir){ current.pos.x += dir; if(collide(board,current)) current.pos.x -= dir; }

  function playerRotate(){ const prev = current.matrix; current.matrix = rotate(current.matrix); // wall kick simple
    if(current.pos.x + current.matrix[0].length > COLS) current.pos.x = COLS - current.matrix[0].length;
    if(collide(board,current)) current.matrix = prev; }

  function hardDrop(){ while(!collide(board,current)){ current.pos.y++; } current.pos.y--; merge(board,current); const cleared = sweep(); if(cleared){ lines += cleared; score += cleared * 100; /* speed up more on hard drop clears */ dropInterval = Math.max(80, dropInterval - cleared*50); } current = next; next = randomPiece(); if(collide(board,current)) gameOver=true; updateScore(); }

  function draw(){ ctx.clearRect(0,0,canvas.width,canvas.height);
    // draw board
    for(let y=0;y<ROWS;y++){
      for(let x=0;x<COLS;x++){
        const val = board[y][x]; if(val){ ctx.fillStyle = colors[val]; ctx.fillRect(x*BLOCK, y*BLOCK, BLOCK-1, BLOCK-1); }
      }
    }
    // draw current piece
    current.matrix.forEach((row,y)=>row.forEach((val,x)=>{ if(val){ ctx.fillStyle=colors[val]; ctx.fillRect((current.pos.x+x)*BLOCK, (current.pos.y+y)*BLOCK, BLOCK-1, BLOCK-1); } }));

    // draw next
    nctx.clearRect(0,0,nextCanvas.width,nextCanvas.height);
    const scale = 24; const nx = {x:1,y:1};
    current && drawNext(next, nctx, scale);
  }

  function drawNext(piece, context, scale){ context.clearRect(0,0,context.canvas.width,context.canvas.height);
    const m = piece.matrix; const offX = Math.floor((context.canvas.width/scale - m[0].length)/2);
    for(let y=0;y<m.length;y++) for(let x=0;x<m[y].length;x++){ const val = m[y][x]; if(val){ context.fillStyle = colors[val]; context.fillRect((x+offX)*scale, y*scale, scale-2, scale-2); } }
  }

  function update(time=0){ if(gameOver){ ctx.fillStyle='rgba(0,0,0,0.6)'; ctx.fillRect(0,0,canvas.width,canvas.height); ctx.fillStyle='#fff'; ctx.font='20px sans-serif'; ctx.fillText('Game Over', canvas.width/2-50, canvas.height/2); return; }
    const delta = time - lastTime; lastTime = time; dropCounter += delta;
    if(!paused && dropCounter > dropInterval){ playerDrop(); dropCounter = 0; }
    draw(); drawNext(next, nctx, 24);
    requestAnimationFrame(update);
  }

  document.addEventListener('keydown', e=>{
    if(e.keyCode===keys.left) playerMove(-1);
    if(e.keyCode===keys.right) playerMove(1);
    if(e.keyCode===keys.down) { playerDrop(); dropCounter = 0; }
    if(e.keyCode===keys.up || e.keyCode===keys.x) playerRotate();
    if(e.keyCode===keys.space) hardDrop();
    if(e.keyCode===keys.p){ paused = !paused; document.getElementById('pause').textContent = paused ? 'Resume' : 'Pause'; }
  });

  document.getElementById('start').addEventListener('click', ()=>{ reset(); paused=false; document.getElementById('pause').textContent='Pause'; requestAnimationFrame(update); });
  document.getElementById('pause').addEventListener('click', ()=>{ paused = !paused; document.getElementById('pause').textContent = paused ? 'Resume' : 'Pause'; });

  // start initially
  reset(); requestAnimationFrame(update);
})();