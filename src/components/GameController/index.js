/* eslint-disable consistent-return */
import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  useLayoutEffect,
} from "react";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import styled, { css, keyframes } from "styled-components";
import {
  updateScore,
  isSongEnd,
  updateCombo,
} from "../../features/reducers/gameSlice";
import {
  NOTES,
  MILLISECOND,
  SPEED,
  KEYS,
  DIFFICULTY,
  COLUMN_RGB_COLORS,
} from "../../store/constants";

export default function GameController({ isRender }) {
  const dispatch = useDispatch();
  const songDuration = Math.max(...NOTES.map((note) => note.time));
  const navigate = useNavigate();

  const [activeKeys, setActiveKeys] = useState([]);
  const [songEnd, setSongEnd] = useState(false);
  const [notes, setNotes] = useState(NOTES);
  const [currentScore, setCurrentScore] = useState(0);
  const [word, setWord] = useState("");

  const canvasRef = useRef(null);
  const notesRef = useRef(notes);
  const deltaRef = useRef(null);
  const comboRef = useRef(0);
  const timeRef = useRef(0);

  const canvas = canvasRef?.current;
  const ctx = canvas?.getContext("2d");

  const columnHeight = canvas?.height * 0.9;
  const columnWidth = canvas?.width / KEYS.length;
  const noteHeight = canvas?.width / (KEYS.length * 3 * 3);
  const borderWidth = 5;
  const hitBoxPositionPercentage = 0.125;
  const positionOfHitBox =
    columnHeight * (1 - hitBoxPositionPercentage) - borderWidth * 2;
  const averageFrame = MILLISECOND / 60;
  const pixerPerFrame = (SPEED / 10) * averageFrame;
  const distanceToHitBoxMiddle = positionOfHitBox - noteHeight;
  const timeToHitBoxMiddle = distanceToHitBoxMiddle / pixerPerFrame; // time = distance / speed;

  const comboResults = useMemo(() => {
    return {
      excellent: 0,
      good: 0,
      miss: 0,
    };
  }, []);

  const keyMappings = useMemo(() => {
    return {
      s: { positionX: columnWidth * 0, color: "rgba(255, 36, 0, 1)" },
      d: { positionX: columnWidth * 1, color: "rgba(125, 249, 255, 1)" },
      f: { positionX: columnWidth * 2, color: "rgba(255, 211, 0, 1)" },
      j: { positionX: columnWidth * 3, color: "rgba(255, 211, 0, 1)" },
      k: { positionX: columnWidth * 4, color: "rgba(125, 249, 255, 1)" },
      l: { positionX: columnWidth * 5, color: "rgba(255, 36, 0, 1)" },
    };
  }, [columnWidth]);

  const calculateScore = (word) => {
    let score;

    switch (word) {
      case "excellent":
        score = 100;
        break;
      case "good":
        score = 70;
        break;
      case "miss":
        score = 0;
        break;
      default:
        score = 0;
    }

    return score;
  };

  const [animateCombo, setAnimateCombo] = useState(false);

  const onPressKey = useCallback(
    (key) => {
      const targetNote = notesRef.current.find((note) => note.key === key);
      const timeFromNoteToHitBox = Math.abs(
        targetNote?.time + timeToHitBoxMiddle - timeRef.current,
      );

      const maximumTiming = SPEED / DIFFICULTY; // 0.33
      const withinTimingThreshold = timeFromNoteToHitBox < maximumTiming;

      if (!withinTimingThreshold) {
        return;
      }

      let currentWord;

      if (timeFromNoteToHitBox <= maximumTiming / 5) {
        currentWord = "excellent";
      } else if (timeFromNoteToHitBox <= maximumTiming / 3) {
        currentWord = "good";
      } else {
        currentWord = "miss";
      }

      setWord(currentWord);

      if (currentWord === "miss") {
        comboRef.current = 0;
      } else {
        setAnimateCombo(true);
        comboRef.current += 1;
        dispatch(updateCombo(comboRef.current));

        setCurrentScore((prevScore) => {
          const incomingScore = calculateScore(currentWord);
          const comboBonus = comboRef.current * incomingScore * 0.5;
          const result = prevScore + incomingScore + comboBonus;

          return result;
        });
      }

      comboResults[currentWord] += 1;

      notesRef.current = notesRef.current.filter((note) => note !== targetNote);
      setNotes((prev) => prev.filter((note) => note !== targetNote));
    },
    [comboResults, dispatch, timeToHitBoxMiddle],
  );

  const activate = useCallback(
    (event) => {
      const { key } = event;
      if (keyMappings[key]) {
        setActiveKeys((prevActiveKeys) => [...prevActiveKeys, key]);
        onPressKey(key);
      }
    },
    [keyMappings, onPressKey],
  );

  const deActivate = useCallback(
    (event) => {
      const { key } = event;
      if (keyMappings[key]) {
        setActiveKeys((prevActiveKeys) => {
          return prevActiveKeys.filter((activeKey) => activeKey !== key);
        });
      }
    },
    [keyMappings],
  );

  const render = useCallback(
    (ctx, { positionX, positionY, key, color }) => {
      const cornerRadius = 5;

      const mapping = keyMappings[key];
      if (mapping) {
        positionX = mapping.positionX;
        color = mapping.color;
      }

      ctx.fillStyle = `${color}`;
      ctx.beginPath();
      ctx.moveTo(positionX + cornerRadius, positionY);
      ctx.lineTo(positionX + columnWidth - cornerRadius, positionY);
      ctx.quadraticCurveTo(
        positionX + columnWidth,
        positionY,
        positionX + columnWidth,
        positionY + cornerRadius,
      );
      ctx.lineTo(
        positionX + columnWidth,
        positionY + noteHeight - cornerRadius,
      );
      ctx.quadraticCurveTo(
        positionX + columnWidth,
        positionY + noteHeight,
        positionX + columnWidth - cornerRadius,
        positionY + noteHeight,
      );
      ctx.lineTo(positionX + cornerRadius, positionY + noteHeight);
      ctx.quadraticCurveTo(
        positionX,
        positionY + noteHeight,
        positionX,
        positionY + noteHeight - cornerRadius,
      );
      ctx.lineTo(positionX, positionY + cornerRadius);
      ctx.quadraticCurveTo(
        positionX,
        positionY,
        positionX + cornerRadius,
        positionY,
      );
      ctx.closePath();
      ctx.fill();
    },
    [columnWidth, keyMappings, noteHeight],
  );

  const update = useCallback(
    (now, delta, ctx, note) => {
      const diffTimeBetweenAnimationFrame = (now - delta) / MILLISECOND;

      if (note) {
        note.positionY += diffTimeBetweenAnimationFrame * SPEED;
      }

      if (note.positionY >= canvas.height) {
        return false;
      }

      return render(ctx, note);
    },
    [canvas?.height, render],
  );

  const renderNotes = useCallback(
    (now, delta, ctx, notes) => {
      const notesArray = notes.sort((prev, next) => prev.time - next.time);

      notesArray.forEach((note) => {
        update(now, delta, ctx, note);
      });
    },
    [update],
  );

  useLayoutEffect(() => {
    let animationFrameId;

    const updateNotes = () => {
      const now = Date.now();

      if (!deltaRef.current) {
        deltaRef.current = now;
      }

      ctx?.clearRect(0, 0, canvas.width, canvas.height);
      timeRef.current += (now - deltaRef.current) / MILLISECOND;
      const visibleNotes = notes.filter((note) => note.time <= timeRef.current);

      renderNotes(now, deltaRef.current, ctx, visibleNotes);

      if (timeRef.current >= songDuration + 5) {
        setSongEnd(true);
      } else {
        animationFrameId = requestAnimationFrame(updateNotes);
      }

      deltaRef.current = now;
    };

    if (isRender) {
      updateNotes();
    }

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [ctx, canvas, notes, renderNotes, songDuration, currentScore, isRender]);

  useEffect(() => {
    dispatch(updateScore(currentScore));

    if (songEnd) {
      dispatch(isSongEnd(comboResults, currentScore));
      navigate("/battles/results");
    }
  }, [comboResults, currentScore, dispatch, navigate, songEnd]);

  useEffect(() => {
    notesRef.current = notes;
    setCurrentScore((prev) => prev + calculateScore(word));
  }, [notes, word]);

  useEffect(() => {
    window.addEventListener("keydown", activate);
    return () => {
      window.removeEventListener("keydown", activate);
    };
  }, [activate]);

  useEffect(() => {
    window.addEventListener("keyup", deActivate);
    return () => {
      window.removeEventListener("keyup", deActivate);
    };
  }, [deActivate]);

  useLayoutEffect(() => {
    if (animateCombo) {
      const timer = setTimeout(() => {
        setAnimateCombo(false);
      }, 250);
      return () => clearTimeout(timer);
    }
  }, [animateCombo]);

  return (
    <GameContainer>
      <CanvasContainer
        ref={canvasRef}
        width={window.innerWidth}
        height={window.innerHeight}
      />
      <TextContainer>
        <div>{word.toUpperCase()}</div>
        <ComboText animate={animateCombo}>
          {comboRef.current === 0 ? null : comboRef.current}
        </ComboText>
        <div>{currentScore === 0 ? null : currentScore}</div>
      </TextContainer>
      <ColumnsContainer>
        {KEYS.map((key, index) => (
          <Column
            key={key}
            index={index}
            colorIndex={index}
            active={activeKeys.includes(key)}
          />
        ))}
      </ColumnsContainer>
      <HitBox />
      <KeyBox>
        {KEYS.map((key, index) => (
          <Key key={key} colorIndex={index} active={activeKeys.includes(key)}>
            {key.toUpperCase()}
          </Key>
        ))}
      </KeyBox>
    </GameContainer>
  );
}

const getColor = (index) => {
  switch (index) {
    case 0:
    case 5:
      return COLUMN_RGB_COLORS[0];
    case 1:
    case 4:
      return COLUMN_RGB_COLORS[1];
    default:
      return COLUMN_RGB_COLORS[2];
  }
};
const GameContainer = styled.div`
  display: flex;
  flex-direction: column;
  position: relative;
  width: 100%;
  height: 100%;
`;

const CanvasContainer = styled.canvas`
  flex: 7;
  background-color: rgba(0, 0, 0, 0.5);
  box-shadow: inset 0 0 0 5px white;
  width: 100%;
  height: 100%;
`;

const growAndShrink = keyframes`
  0% {
    transform: scale(1);
  }
  50% {
    transform: scale(2);
  }
  100% {
    transform: scale(1);
  }
`;

const ComboText = styled.div`
  animation: ${({ animate }) =>
    animate
      ? css`
          ${growAndShrink} 0.25s
        `
      : "none"};
`;

const ColumnsContainer = styled.div`
  position: absolute;
  width: 100%;
  height: 100%;
`;

const Column = styled.div`
  position: absolute;
  top: 5px;
  left: ${({ index }) => `calc(100% / 6 * ${index})`};
  background-color: transparent;
  width: ${({ index }) =>
    index === 5 ? `calc(100% / 6 - 5px)` : `calc(100% / 6)`};
  height: ${`calc(87.5% - 10px)`};
  border-right: ${({ index }) => (index === 5 ? null : "2px solid gray")};

  ${({ active, colorIndex }) => {
    const color = getColor(colorIndex);
    return (
      active &&
      `
      background: linear-gradient(to top, rgba(${color}, 0.8), rgba(${color}, 0));
    `
    );
  }}
`;

const HitBox = styled.div`
  position: absolute;
  bottom: 12.5%;
  background-color: rgba(255, 255, 255, 0.2);
  width: 100%;
  height: 3%;
`;

const KeyBox = styled.div`
  display: flex;
  flex: 1;
  width: 100%;
  height: 100%;
`;

const Key = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: 2em;
  color: white;
  width: 100%;
  box-shadow: inset 0 0 0 5px white;
  transition: transform 0.1s ease;

  ${({ active, colorIndex }) => {
    const color = getColor(colorIndex);
    return (
      active &&
      `
      background: rgba(${color}, 1);
      transform: scale(1.25);
    `
    );
  }}
`;

const TextContainer = styled.div`
  display: flex;
  align-items: center;
  flex-direction: column;
  position: absolute;
  width: 100%;
  top: 45%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: white;
  font-size: 3em;
  z-index: 1;
`;
