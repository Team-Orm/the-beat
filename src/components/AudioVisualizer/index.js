import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import styled from "styled-components";

export default function AudioVisualizer({ song, isPlaying }) {
  const navigate = useNavigate();
  const [audioBuffer, setAudioBuffer] = useState(null);
  const createAudioContextAndSource = useCallback((audioBuffer) => {
    const audioContext = new AudioContext();
    const source = audioContext.createBufferSource();

    if (audioBuffer) {
      source.buffer = audioBuffer;
    }

    return { audioContext, source };
  }, []);

  const startVisualization = useCallback(async () => {
    const { audioContext, source } = createAudioContextAndSource(audioBuffer);
    await audioContext.resume();
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    source.connect(analyser);
    analyser.connect(audioContext.destination);

    const canvas = document.getElementById("audio-visualizer");
    const ctx = canvas.getContext("2d");
    const { width } = canvas;
    const { height } = canvas;

    const particles = [];

    const draw = () => {
      requestAnimationFrame(draw);

      analyser.getByteTimeDomainData(dataArray);

      ctx.clearRect(0, 0, width, height);

      ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
      ctx.fillRect(0, 0, width, height);

      const centerX = width / 2;
      const centerY = height / 2;
      const baseRadius = 80;

      const averageAmplitude =
        dataArray.reduce((acc, value) => acc + value, 0) / dataArray.length;

      const scaleFactor = 1 + averageAmplitude / 255;
      const innerCircleRadius = baseRadius * scaleFactor;

      ctx.beginPath();
      let angle = -Math.PI / 2;

      for (let i = 0; i < bufferLength - 1; i++) {
        const v = dataArray[i] / 128.0;
        const radius = innerCircleRadius + v * 50;
        const x = centerX + radius * Math.cos(angle);
        const y = centerY + radius * Math.sin(angle);

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }

        const angleIncrement = (2 * Math.PI) / (bufferLength - 1);

        angle += angleIncrement;
      }

      ctx.closePath();
      ctx.strokeStyle = "rgba(255, 255, 255, 1)";
      ctx.lineWidth = 3;
      ctx.stroke();

      const numParticles = Math.floor(averageAmplitude / 120);
      const maxAmplitude = Math.max(...dataArray);
      const speedScaleFactor = 1;
      const particleSpeed = (maxAmplitude / 128.0) * speedScaleFactor;
      const particleRadius = 2;
      const particleColor = `rgba(255, 255, 255, 0.8)`;

      for (let i = 0; i < numParticles; i++) {
        const angle = Math.random() * 2 * Math.PI;
        const radius =
          innerCircleRadius +
          (dataArray[Math.floor((i / numParticles) * bufferLength)] / 128.0) *
            50;

        const x = centerX + radius * Math.cos(angle);
        const y = centerY + radius * Math.sin(angle);
        const vx = Math.cos(angle) * particleSpeed;
        const vy = Math.sin(angle) * particleSpeed;

        particles.push({ x, y, vx, vy, particleColor });
      }

      particles.forEach((particle) => {
        particle.x += particle.vx;
        particle.y += particle.vy;

        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particleRadius, 0, 2 * Math.PI);
        ctx.fillStyle = particleColor;
        ctx.fill();
      });
    };

    draw();

    source.start(0);
  }, [audioBuffer, createAudioContextAndSource]);

  const getBuffer = useCallback(async () => {
    if (song?.audioURL) {
      try {
        const response = await axios.get(
          "http://localhost:8000/proxy/audio-server",
          {
            responseType: "arraybuffer",
            params: { url: song?.audioURL },
          },
        );

        if (response.status === 200) {
          const audioData = new Uint8Array(response.data).buffer;
          const { audioContext, source } = createAudioContextAndSource(null);

          const buffer = await audioContext.decodeAudioData(audioData);
          setAudioBuffer(buffer);
          source.buffer = buffer;
        }
      } catch (err) {
        navigate("/error", {
          state: {
            status: err.response.status,
            text: err.response.statusText,
            message: err.message,
          },
        });
      }
    }
  }, [createAudioContextAndSource, navigate, song?.audioURL]);

  useEffect(() => {
    if (isPlaying) {
      startVisualization();
    }
  }, [isPlaying, startVisualization]);

  useEffect(() => {
    if (song?.audioURL) {
      getBuffer();
    }
  }, [getBuffer, song?.audioURL]);

  return (
    <CanvasWrapper>
      <canvas id="audio-visualizer" width="1900" height="880" />
    </CanvasWrapper>
  );
}

const CanvasWrapper = styled.div`
  position: absolute;
  top: 45%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
`;
