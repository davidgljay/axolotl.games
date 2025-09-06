
import React from "react";

const Home: React.FC = () => {
  return (
    <div>
      <style>{`
        body, .axolotl-home-root {
            margin: 0;
            padding: 0;
            font-family: Arial, sans-serif;
            background-color: #f0f0f0;
        }
        .container {
            display: flex;
            align-items: center;
            justify-content: center;
            flex-direction: row;
            min-height: 20vh;
            background-color: #ff69b4;
            color: white;
            text-align: center;
            padding: 2rem;
        }
        h1 {
            margin: 0 0 1rem 0;
            font-size: 3rem;
        }
        h2 {
            margin: 0;
            font-size: 1.5rem;
            font-weight: normal;
        }
        .game-link-wrapper {
            display: flex;
            justify-content: center;
            margin-top: 2rem;
        }
        .game-link {
            text-decoration: none;
            color: inherit;
        }
        .game-preview-img {
            width: 400px;
            max-width: 90vw;
            border-radius: 16px;
            box-shadow: 0 6px 24px rgba(0,0,0,0.15);
            transition: transform 0.2s;
        }
        .game-title {
            text-align: center;
            margin-top: 0.5rem;
            font-size: 1.2rem;
            font-weight: bold;
        }
      `}</style>
      <div className="axolotl-home-root">
        <div className="container">
          <img
            src="/img/axolotlrainbow.png"
            alt="Axolotl Rainbow"
            style={{ height: "120px", marginRight: "2rem" }}
          />
          <div>
            <h1>Axolotl Games</h1>
            <h2>Come play some games about all kinds of stuff.</h2>
            <p>
              <a href="https://www.youtube.com/watch?v=dQw4w9WgXcQ">Click me</a>
            </p>
          </div>
          <img
            src="/img/axolotlrainbow.png"
            alt="Axolotl Rainbow"
            style={{ height: "120px", marginLeft: "2rem" }}
          />
        </div>
        <div className="game-link-wrapper">
          <a
            href="axolotl_cake_run.html"
            className="game-link"
          >
            <img
              src="/img/game_preview.png"
              alt="Axolotl Cake Run Preview"
              className="game-preview-img"
            />
            <div className="game-title">
              Play Axolotl Cake Run
            </div>
          </a>
        </div>
        <div className="game-link-wrapper">
          <a
            href="axolotl_character_creator.html"
            className="game-link"
          >
            <img
              src="/img/character_creator_preview.png"
              alt="Axolotl Character Creator Preview"
              className="game-preview-img"
            />
            <div className="game-title">
              Axolotl Character Creator
            </div>
          </a>
        </div>
      </div>
    </div>
  );
};

export default Home;