"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import "./FHEFlappyBirdGame.css";
import { useFhevm } from "@fhevm-sdk";
import { motion } from "framer-motion";
import { useAccount } from "wagmi";
import { RainbowKitCustomConnectButton } from "~~/components/helper/RainbowKitCustomConnectButton";
import { useFHEFlappyBird } from "~~/hooks/useFHEFlappyBird";

let BEST_SCORE = 0;

export const FHEFlappyBirdGame: React.FC = () => {
  const { isConnected, chain } = useAccount();
  const chainId = chain?.id;

  const provider = useMemo(() => (typeof window !== "undefined" ? (window as any).ethereum : undefined), []);

  const initialMockChains = {
    11155111: `https://eth-sepolia.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}`,
  };

  const {
    instance: fhevmInstance,
    status: fheStatus,
    error: fheError,
  } = useFhevm({
    provider,
    chainId,
    initialMockChains,
    enabled: true,
  });

  const { submitFlyScore, decryptResult, canDecrypt, isDecrypting, bestScore, results, message } = useFHEFlappyBird({
    instance: fhevmInstance,
    initialMockChains,
  });

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const descRef = useRef<HTMLParagraphElement | null>(null);
  const [currentScore, setCurrentScore] = useState(0);

  useEffect(() => {
    const cvs = canvasRef.current;
    const description = descRef.current;
    if (!cvs || !description) return;

    const ctx = cvs.getContext("2d")!;
    const theme1 = new Image();
    const theme2 = new Image();
    theme1.src = "og-theme.png";
    theme2.src = "og-theme-2.png";

    let frame = 0;
    const degree = Math.PI / 180;

    const gameState = {
      current: 0,
      getReady: 0,
      play: 1,
      gameOver: 2,
    };

    const bg = {
      imgX: 0,
      imgY: 0,
      width: 276,
      height: 228,
      x: 0,
      y: cvs.height - 228,
      w: 276,
      h: 228,
      dx: 0.2,
      render() {
        ctx.drawImage(theme1, this.imgX, this.imgY, this.width, this.height, this.x, this.y, this.w, this.h);
        ctx.drawImage(
          theme1,
          this.imgX,
          this.imgY,
          this.width,
          this.height,
          this.x + this.width,
          this.y,
          this.w,
          this.h,
        );
        ctx.drawImage(
          theme1,
          this.imgX,
          this.imgY,
          this.width,
          this.height,
          this.x + this.width * 2,
          this.y,
          this.w,
          this.h,
        );
      },
      position() {
        if (gameState.current === gameState.getReady) this.x = 0;
        if (gameState.current === gameState.play) this.x = (this.x - this.dx) % this.w;
      },
    };

    const ground = {
      imgX: 276,
      imgY: 0,
      width: 224,
      height: 112,
      x: 0,
      y: cvs.height - 112,
      w: 224,
      h: 112,
      dx: 2,
      render() {
        ctx.drawImage(theme1, this.imgX, this.imgY, this.width, this.height, this.x, this.y, this.w, this.h);
        ctx.drawImage(
          theme1,
          this.imgX,
          this.imgY,
          this.width,
          this.height,
          this.x + this.width,
          this.y,
          this.w,
          this.h,
        );
      },
      position() {
        if (gameState.current === gameState.getReady) this.x = 0;
        if (gameState.current === gameState.play) this.x = (this.x - this.dx) % (this.w / 2);
      },
    };

    const pipes = {
      top: { imgX: 56, imgY: 323 },
      bot: { imgX: 84, imgY: 323 },
      width: 26,
      height: 160,
      w: 55,
      h: 300,
      gap: 85,
      dx: 2,
      minY: -260,
      maxY: -40,
      pipeGenerator: [] as { x: number; y: number; passed: boolean }[],
      reset() {
        this.pipeGenerator = [];
      },
      render() {
        for (const pipe of this.pipeGenerator) {
          const topPipe = pipe.y;
          const bottomPipe = pipe.y + this.gap + this.h;
          ctx.drawImage(theme2, this.top.imgX, this.top.imgY, this.width, this.height, pipe.x, topPipe, this.w, this.h);
          ctx.drawImage(
            theme2,
            this.bot.imgX,
            this.bot.imgY,
            this.width,
            this.height,
            pipe.x,
            bottomPipe,
            this.w,
            this.h,
          );
        }
      },
      position() {
        if (gameState.current !== gameState.play) return;

        if (frame % 100 === 0) {
          this.pipeGenerator.push({
            x: cvs.width,
            y: Math.floor(Math.random() * (this.maxY - this.minY + 1)) + this.minY,
            passed: false,
          });
        }

        for (let i = 0; i < this.pipeGenerator.length; i++) {
          const pg = this.pipeGenerator[i];
          pg.x -= this.dx;
          if (pg.x < -this.w) this.pipeGenerator.shift();

          const b = { left: bird.x - bird.r, right: bird.x + bird.r, top: bird.y - bird.r, bottom: bird.y + bird.r };
          const p = {
            top: { top: pg.y, bottom: pg.y + this.h },
            bot: { top: pg.y + this.h + this.gap, bottom: pg.y + this.h * 2 + this.gap },
            left: pg.x,
            right: pg.x + this.w,
          };
          if (
            (b.left < p.right && b.right > p.left && b.top < p.top.bottom && b.bottom > p.top.top) ||
            (b.left < p.right && b.right > p.left && b.top < p.bot.bottom && b.bottom > p.bot.top)
          ) {
            gameState.current = gameState.gameOver;
          }

          if (pg.x + this.w / 2 < bird.x && !pg.passed) {
            score.current++;
            setCurrentScore(score.current);
            pg.passed = true;
            if (score.current > BEST_SCORE) BEST_SCORE = score.current;
          }
        }
      },
    };

    const score = {
      current: 0,
      reset() {
        this.current = 0;
      },
      render() {
        ctx.fillStyle = "white";
        ctx.font = "20px Carter One";
        if (gameState.current === gameState.play || gameState.current === gameState.gameOver) {
          ctx.fillText(`${this.current}`, cvs.width / 2 - 10, 40);
        }
      },
    };

    const bird = {
      animation: [
        { imgX: 276, imgY: 114 },
        { imgX: 276, imgY: 140 },
        { imgX: 276, imgY: 166 },
        { imgX: 276, imgY: 140 },
      ],
      fr: 0,
      width: 34,
      height: 24,
      x: 50,
      y: 160,
      w: 34,
      h: 24,
      r: 12,
      fly: 5.25,
      gravity: 0.32,
      velocity: 0,
      rotation: 0,
      render() {
        const birdFrame = this.animation[this.fr];
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        ctx.drawImage(
          theme1,
          birdFrame.imgX,
          birdFrame.imgY,
          this.width,
          this.height,
          -this.w / 2,
          -this.h / 2,
          this.w,
          this.h,
        );
        ctx.restore();
      },
      flap() {
        this.velocity = -this.fly;
      },
      position() {
        if (gameState.current === gameState.getReady) {
          this.y = 160;
          this.rotation = 0;
          if (frame % 20 === 0) this.fr = (this.fr + 1) % this.animation.length;
        } else {
          if (frame % 4 === 0) this.fr = (this.fr + 1) % this.animation.length;
          this.velocity += this.gravity;
          this.y += this.velocity;
          this.rotation = this.velocity <= this.fly ? -15 * degree : 70 * degree;
          if (this.y + this.h / 2 >= cvs.height - ground.h) {
            this.y = cvs.height - ground.h - this.h / 2;
            gameState.current = gameState.gameOver;
          }
          if (this.y - this.h / 2 <= 0) this.y = this.r;
        }
      },
    };

    const getReady = {
      render() {
        if (gameState.current === gameState.getReady) {
          ctx.fillStyle = "white";
          ctx.font = "18px Carter One";
          ctx.fillText("Get Ready!", cvs.width / 2 - 50, cvs.height / 2 - 60);
        }
      },
    };

    const gameOver = {
      render() {
        if (gameState.current === gameState.gameOver) {
          ctx.fillStyle = "white";
          ctx.font = "24px Carter One";
          ctx.fillText("GAME OVER", cvs.width / 2 - 80, cvs.height / 2 - 80);
          ctx.font = "20px Carter One";
          ctx.fillText(`SCORE: ${score.current}`, cvs.width / 2 - 60, cvs.height / 2 - 40);
          description.style.visibility = "visible";
        }
      },
    };

    const draw = () => {
      ctx.fillStyle = "#00bbc4";
      ctx.fillRect(0, 0, cvs.width, cvs.height);
      bg.render();
      pipes.render();
      ground.render();
      score.render();
      bird.render();
      getReady.render();
      gameOver.render();
    };

    const update = () => {
      bird.position();
      bg.position();
      pipes.position();
      ground.position();
    };

    const loop = () => {
      draw();
      update();
      frame++;
    };

    const interval = setInterval(loop, 17);

    const onClick = () => {
      if (gameState.current === gameState.getReady) {
        gameState.current = gameState.play;
      } else if (gameState.current === gameState.play) {
        bird.flap();
        description.style.visibility = "hidden";
      } else if (gameState.current === gameState.gameOver) {
        pipes.reset();
        score.reset();
        bird.y = 160;
        bird.velocity = 0;
        bird.rotation = 0;
        bird.fr = 0;
        frame = 0;
        description.style.visibility = "visible";
        gameState.current = gameState.getReady;
      }
    };

    cvs.addEventListener("click", onClick);
    document.addEventListener("keydown", e => {
      if (e.code === "Space") onClick();
    });

    return () => {
      clearInterval(interval);
      cvs.removeEventListener("click", onClick);
    };
  }, []);

  /** 🎯 UI **/
  return (
    <div className="container">
      <div className="game-title">
        <h1>FLAPPY BIRD</h1>
      </div>

      {/* ======== GAME SCREEN ======== */}
      <div className={`game-screen ${!isConnected ? "hidden" : ""}`}>
        <canvas ref={canvasRef} id="game" width="300" height="500"></canvas>
        <p ref={descRef} id="description" className="game-description">
          Press 'spacebar' or 'click' to begin
        </p>
      </div>

      {/* ======== ONCHAIN SECTION ======== */}
      <div className="onchain-section">
        {!isConnected ? (
          <RainbowKitCustomConnectButton />
        ) : (
          <div className="mt-20 flex flex-col items-center gap-4">
            <motion.button
              className={`w-55 px-6 py-3 font-bold rounded-2xl shadow-md transition
              ${currentScore === 0 ? "bg-blue-300 cursor-not-allowed opacity-70" : "bg-blue-600 hover:bg-blue-700 active:scale-95 text-white cursor-pointer"}`}
              whileTap={{ scale: 0.95 }}
              disabled={currentScore === 0}
              onClick={() => submitFlyScore(currentScore)}
            >
              Submit On-chain
            </motion.button>

            <motion.button
              className={`w-55 px-6 py-3 rounded-2xl font-bold shadow-md transition ${
                canDecrypt
                  ? "bg-green-600 text-white hover:bg-green-700 active:scale-95"
                  : "bg-gray-400 text-gray-100 cursor-not-allowed"
              }`}
              whileTap={{ scale: canDecrypt ? 0.95 : 1 }}
              disabled={!canDecrypt}
              onClick={decryptResult}
            >
              {isDecrypting ? "Decrypting..." : "Decrypt Best Score"}
            </motion.button>

            {bestScore?.handle &&
              results?.[bestScore.handle] !== undefined &&
              !isNaN(Number(results[bestScore.handle])) && (
                <p className="text-lg font-semibold text-yellow-400 mt-2">
                  🏆 On-chain Best Score: <span className="text-white">{Number(results[bestScore.handle])}</span>
                </p>
              )}
          </div>
        )}
      </div>
    </div>
  );
};
