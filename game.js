const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const livesEl = document.getElementById('lives');
const overlay = document.getElementById('overlay');
const startBtn = document.getElementById('start-btn');
const overlayTitle = document.getElementById('overlay-title');
const overlayMessage = document.getElementById('overlay-message');

// Game state
let score = 0;
let lives = 3;
let paused = true;
let gameRunning = false;

// Paddle constants
const PADDLE_HEIGHT = 15;
const PADDLE_WIDTH_DEFAULT = 100;

// Ball constants
const BALL_RADIUS = 8;
const BALL_SPEED_DEFAULT = 3; // Velocidad de la bola más tranquila

// Sound Manager using Web Audio API
const SoundManager = {
    ctx: new (window.AudioContext || window.webkitAudioContext)(),

    playBounce() {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(150, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(100, this.ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.1);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.1);
    },

    playPowerUp() {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(400, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(800, this.ctx.currentTime + 0.2);
        gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.2);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.2);
    },

    playWin() {
        // Simple "Muchachos" chime or triumphant fanfare
        const notes = [261.63, 329.63, 392.00, 523.25]; // C4, E4, G4, C5
        notes.forEach((freq, i) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.frequency.setValueAtTime(freq, this.ctx.currentTime + i * 0.15);
            gain.gain.setValueAtTime(0.1, this.ctx.currentTime + i * 0.15);
            gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + i * 0.15 + 0.3);
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start(this.ctx.currentTime + i * 0.15);
            osc.stop(this.ctx.currentTime + i * 0.15 + 0.3);
        });
    }
};

const PADDLE_GAP = 20;


// Paddle object
const paddle = {
    x: 0,
    y: 0,
    width: PADDLE_WIDTH_DEFAULT,
    height: PADDLE_HEIGHT,
    color: '#74ACDF',
    count: 1 // Cantidad de barras (1, 2, 4, 8...)
};

// Balls array (for multi-ball)
let balls = [];

// Bricks array
let bricks = [];
const brickRowCount = 6;
const brickColumnCount = 8;
const brickPadding = 10;
const brickOffsetTop = 40;
const brickOffsetLeft = 10;

// Power-ups array
let powerUps = [];
const POWERUP_TYPES = [
    { name: 'Mate', symbol: '🧉', color: '#4CAF50', effect: 'multi-ball' },
    { name: 'Copa', symbol: '🏆', color: '#FFD700', effect: 'expand-paddle' },
    { name: 'Empanada', symbol: '🥟', color: '#FFB81C', effect: 'enlarge-ball' },
    { name: 'Asado', symbol: '🥩', color: '#F44336', effect: 'split-paddle' }
];

// Resize canvas to match display size
function resize() {
    const container = canvas.parentElement;
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight - 80; // Adjust for header

    paddle.x = (canvas.width - paddle.width) / 2;
    paddle.y = canvas.height - 30;

    if (!gameRunning) {
        initBricks();
    }
}

function initBricks() {
    const brickWidth = (canvas.width - (brickOffsetLeft * 2) - ((brickColumnCount - 1) * brickPadding)) / brickColumnCount;
    const brickHeight = 25;

    bricks = [];
    for (let c = 0; c < brickColumnCount; c++) {
        bricks[c] = [];
        for (let r = 0; r < brickRowCount; r++) {
            bricks[c][r] = {
                x: 0,
                y: 0,
                status: 1,
                color: r % 2 === 0 ? '#74ACDF' : '#FFFFFF' // Light blue and white stripes
            };
        }
    }

    // Set actual brick positions
    for (let c = 0; c < brickColumnCount; c++) {
        for (let r = 0; r < brickRowCount; r++) {
            bricks[c][r].x = (c * (brickWidth + brickPadding)) + brickOffsetLeft;
            bricks[c][r].y = (r * (brickHeight + brickPadding)) + brickOffsetTop;
            bricks[c][r].w = brickWidth;
            bricks[c][r].h = brickHeight;
        }
    }
}

function createBall() {
    return {
        x: paddle.x + paddle.width / 2,
        y: paddle.y - BALL_RADIUS - 1,
        dx: BALL_SPEED_DEFAULT * (Math.random() > 0.5 ? 1 : -1),
        dy: -BALL_SPEED_DEFAULT,
        radius: BALL_RADIUS,
        color: '#FFB81C' // Sol de Mayo color
    };
}

// Input handling
function movePaddle(e) {
    const rect = canvas.getBoundingClientRect();
    let relativeX;
    if (e.type === 'touchmove') {
        relativeX = e.touches[0].clientX - rect.left;
    } else {
        relativeX = e.clientX - rect.left;
    }

    // Scale relativeX based on canvas internal resolution vs visual size
    relativeX = relativeX * (canvas.width / rect.width);

    if (relativeX > 0 && relativeX < canvas.width) {
        paddle.x = relativeX - (getTotalPaddleWidth() / 2);

        // Boundaries
        const totalW = getTotalPaddleWidth();
        if (paddle.x < 0) paddle.x = 0;
        if (paddle.x + totalW > canvas.width) paddle.x = canvas.width - totalW;
    }
}

window.addEventListener("mousemove", movePaddle, false);
window.addEventListener("touchmove", (e) => {
    if (e.target === canvas) {
        e.preventDefault();
    }
    movePaddle(e);
}, { passive: false });

function getTotalPaddleWidth() {
    return (paddle.width * paddle.count) + (PADDLE_GAP * (paddle.count - 1));
}

function drawPaddle() {
    ctx.fillStyle = paddle.color;
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2;

    for (let i = 0; i < paddle.count; i++) {
        const xPos = paddle.x + (i * (paddle.width + PADDLE_GAP));
        ctx.beginPath();
        ctx.roundRect(xPos, paddle.y, paddle.width, paddle.height, 10);
        ctx.fill();
        ctx.stroke();
        ctx.closePath();
    }
}

function drawBall(ball) {
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
    ctx.fillStyle = ball.color;
    ctx.fill();

    // Add a sun-like glow
    ctx.shadowBlur = 10;
    ctx.shadowColor = ball.color;

    ctx.closePath();
    ctx.shadowBlur = 0; // Reset for other elements
}

function drawBricks() {
    for (let c = 0; c < brickColumnCount; c++) {
        for (let r = 0; r < brickRowCount; r++) {
            if (bricks[c][r].status === 1) {
                const b = bricks[c][r];
                ctx.beginPath();
                ctx.roundRect(b.x, b.y, b.w, b.h, 4);
                ctx.fillStyle = b.color;
                ctx.fill();
                ctx.closePath();
            }
        }
    }
}

function collisionDetection() {
    for (let c = 0; c < brickColumnCount; c++) {
        for (let r = 0; r < brickRowCount; r++) {
            const b = bricks[c][r];
            if (b.status === 1) {
                balls.forEach(ball => {
                    if (ball.x > b.x && ball.x < b.x + b.w && ball.y > b.y && ball.y < b.y + b.h) {
                        ball.dy = -ball.dy;
                        b.status = 0;
                        score += 10;
                        scoreEl.innerText = score;
                        SoundManager.playBounce();

                        // Spawn power-up
                        if (Math.random() < 0.15) {
                            spawnPowerUp(b.x + b.w / 2, b.y + b.h / 2);
                        }

                        if (isLevelComplete()) {
                            SoundManager.playWin();
                            gameOver("¡Dale Campeón!", "¡Has ganado el Argenoid y traído la copa a casa!");
                        }
                    }
                });
            }
        }
    }
}

function isLevelComplete() {
    for (let c = 0; c < brickColumnCount; c++) {
        for (let r = 0; r < brickRowCount; r++) {
            if (bricks[c][r].status === 1) return false;
        }
    }
    return true;
}

function spawnPowerUp(x, y) {
    const type = POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)];
    powerUps.push({
        x: x,
        y: y,
        w: 30,
        h: 30,
        dy: 2, // Caída de power-ups a mitad de velocidad
        ...type
    });
}

function drawPowerUps() {
    powerUps.forEach((p, index) => {
        p.y += p.dy;

        ctx.font = "24px serif";
        ctx.textAlign = "center";
        ctx.fillText(p.symbol, p.x, p.y);

        // Paddle collision
        if (p.y + 15 > paddle.y && p.x > paddle.x && p.x < paddle.x + getTotalPaddleWidth()) {
            applyPowerUp(p.effect);
            triggerPaddleFlash();
            SoundManager.playPowerUp();
            powerUps.splice(index, 1);
        } else if (p.y > canvas.height) {
            powerUps.splice(index, 1);
        }
    });
}

function applyPowerUp(effect) {
    if (effect === 'multi-ball') {
        const currentBall = balls[0] || createBall();
        for (let i = 0; i < 3; i++) { // Más bolas para más locura
            balls.push({
                ...currentBall,
                dx: (Math.random() - 0.5) * 8,
                dy: -Math.abs(currentBall.dy)
            });
        }
    } else if (effect === 'expand-paddle') {
        paddle.width += 40;
        if (paddle.width > canvas.width * 0.9) paddle.width = canvas.width * 0.9;
        // Permanente
    } else if (effect === 'enlarge-ball') {
        balls.forEach(ball => {
            ball.radius += 5;
            if (ball.radius > 40) ball.radius = 40;
        });
        // Permanente
    } else if (effect === 'split-paddle') {
        paddle.count *= 2; // Duplicar cantidad de barras
        if (paddle.count > 8) paddle.count = 8; // Límite para no romper el juego
    }
}

function draw() {
    if (paused) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    drawBricks();
    drawPaddle();
    drawPowerUps();

    balls.forEach((ball, index) => {
        drawBall(ball);

        // Wall collisions
        if (ball.x + ball.dx > canvas.width - ball.radius || ball.x + ball.dx < ball.radius) {
            ball.dx = -ball.dx;
            SoundManager.playBounce();
        }
        if (ball.y + ball.dy < ball.radius) {
            ball.dy = -ball.dy;
            SoundManager.playBounce();
        } else if (ball.y + ball.dy > paddle.y - ball.radius) {
            let hit = false;
            for (let i = 0; i < paddle.count; i++) {
                const xPos = paddle.x + (i * (paddle.width + PADDLE_GAP));
                if (ball.x > xPos && ball.x < xPos + paddle.width) {
                    hit = true;
                    break;
                }
            }

            if (hit) {
                // Ball hit the paddle
                SoundManager.playBounce();
                let totalW = getTotalPaddleWidth();
                let hitPos = (ball.x - (paddle.x + totalW / 2)) / (totalW / 2);
                ball.dx = hitPos * BALL_SPEED_DEFAULT;
                ball.dy = -Math.abs(ball.dy);
            } else if (ball.y + ball.dy > canvas.height - ball.radius) {
                balls.splice(index, 1);
            }
        }

        ball.x += ball.dx;
        ball.y += ball.dy;
    });

    if (balls.length === 0) {
        lives--;
        livesEl.innerText = lives;
        if (lives <= 0) {
            gameOver("FINAL DEL PARTIDO", "Te quedaste sin vidas. ¿Otro?");
        } else {
            resetBall();
        }
    }

    collisionDetection();
    requestAnimationFrame(draw);
}

function resetBall() {
    balls = [createBall()];
    paused = true;
    overlayTitle.innerText = "¡PREPARATE!";
    overlayMessage.innerText = "Toca para lanzar la bola";
    startBtn.innerText = "LANZAR";
    overlay.classList.remove('hidden');
}

function gameOver(title, msg) {
    paused = true;
    gameRunning = false;
    overlayTitle.innerText = title;
    overlayMessage.innerText = `${msg} | Puntos: ${score}`;
    startBtn.innerText = "VOLVER A INTENTAR";
    overlay.classList.remove('hidden');
}

function startGame() {
    SoundManager.ctx.resume(); // Ensure AudioContext is active
    if (!gameRunning) {
        score = 0;
        lives = 3;
        scoreEl.innerText = score;
        livesEl.innerText = lives;
        paddle.width = PADDLE_WIDTH_DEFAULT;
        paddle.count = 1;
        initBricks();
        gameRunning = true;
    }

    balls = [createBall()];
    powerUps = [];
    paused = false;
    overlay.classList.add('hidden');
    draw();
}

function triggerPaddleFlash() {
    canvas.classList.add('paddle-flash');
    setTimeout(() => {
        canvas.classList.remove('paddle-flash');
    }, 300);
}

startBtn.addEventListener('click', startGame);

window.addEventListener('resize', resize);
resize();
