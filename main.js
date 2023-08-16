(function () {
    const cellWidthInPixels = 23;
    const cellHeightInPixels = 23;
    const cellSizeInPixels = cellWidthInPixels > cellHeightInPixels ? cellHeightInPixels : cellWidthInPixels;
    const chunkWidthInCells = 33;
    const chunkHeightInCells = 33;

    const chunkWidthInPixels = cellWidthInPixels * chunkWidthInCells;
    const chunkHeightInPixels = cellHeightInPixels * chunkHeightInCells;

    const cellStateUnknown = "unknown";
    const cellStateFlag = "flag";
    const cellStateQuestion = "question";
    const cellStateExplosion = "explosion";
    const cellStateCounter0 = "0";
    const cellStateCounter1 = "1";
    const cellStateCounter2 = "2";
    const cellStateCounter3 = "3";
    const cellStateCounter4 = "4";
    const cellStateCounter5 = "5";
    const cellStateCounter6 = "6";
    const cellStateCounter7 = "7";
    const cellStateCounter8 = "8";

    const difficultyNormal = "normal";

    const minedPercent = 0.268;
    const firstSafeCells = 27;
    const healthGainPerCell = 0.035;

    class Game {
        viewport;
        difficulty;
        health;
        scores;
        cells;
        clickState;

        constructor() {
            this.viewport = new Viewport();
            this.difficulty = difficultyNormal;
            this.setHealth(100);
            this.setScores(0);
            this.cells = {};
            this.clickState = {
                isClick: false,
                isAltClick: false,
                isMove: false,
                x: 0,
                y: 0,
            };

            this.loadState()

            document.getElementById("viewport").addEventListener("click", (event) => {
                event.preventDefault();
                event.stopPropagation();
            })

            document.getElementById("viewport").addEventListener("contextmenu", (event) => {
                event.preventDefault();
                event.stopPropagation();
            })

            document.getElementById("viewport").addEventListener("mousedown", (event) => {
                event.preventDefault();
                event.stopPropagation();

                if (event.buttons === 1) {
                    this.clickState.isClick = true;
                    this.clickState.isAltClick = false;
                    this.clickState.isMove = false;
                    this.clickState.x = event.clientX;
                    this.clickState.y = event.clientY;
                } else if (event.buttons === 2) {
                    this.clickState.isClick = false;
                    this.clickState.isAltClick = true;
                    this.clickState.isMove = false;
                    this.clickState.x = event.clientX;
                    this.clickState.y = event.clientY;
                } else {
                    this.clickState.isClick = false;
                    this.clickState.isAltClick = false;
                    this.clickState.isMove = false;
                    this.clickState.x = 0;
                    this.clickState.y = 0;
                }
            });

            document.getElementById("viewport").addEventListener("mousemove", (event) => {
                event.preventDefault();
                event.stopPropagation();

                const deltaX = event.clientX - this.clickState.x;
                const deltaY = event.clientY - this.clickState.y;
                const locationDelta = Math.abs(deltaX) + Math.abs(deltaY);

                if ((this.clickState.isClick || this.clickState.isMove) && locationDelta) {
                    if (this.clickState.isMove) {
                        this.clickState.isClick = false;
                        this.clickState.isAltClick = false;

                        this.viewport.move({x: deltaX, y :deltaY});

                        this.clickState.x = event.clientX;
                        this.clickState.y = event.clientY;
                    } else if (locationDelta > 3) {
                        this.clickState.isClick = false;
                        this.clickState.isAltClick = false;
                        this.clickState.isMove = true;
                    }
                }
            });

            document.getElementById("viewport").addEventListener("mouseup", (event) => {
                event.preventDefault();
                event.stopPropagation();

                const fieldLocation = this.viewport.getFieldLocationByClickLocation({
                    x: event.clientX,
                    y: event.clientY,
                })

                if (this.clickState.isClick && event.button === 0) {
                    this.handleClick(fieldLocation);
                } else if (this.clickState.isAltClick && event.button === 2) {
                    this.handleMark(fieldLocation);
                }

                this.clickState.isClick = false;
                this.clickState.isAltClick = false;
                this.clickState.isMove = false;
                this.clickState.startX = 0;
                this.clickState.startY = 0;

                this.viewport.updateChunks();
                this.saveState();
            });

            document.getElementById("viewport").addEventListener("mouseleave", (event) => {
                event.preventDefault();
                event.stopPropagation();
            });

            document.getElementById("restart").addEventListener("click", (event) => {
                event.preventDefault();
                event.stopPropagation();

                this.resetState();
            });
        }

        setHealth(health) {
            this.health = health;
            document.getElementById("heath").innerText = health < 0 ? "0" : Math.ceil(health).toString();
        }

        setScores(scores) {
            this.scores = scores;
            document.getElementById("scores").innerText = scores;
        }

        resetState() {
            window.localStorage.removeItem("game_state_" + this.difficulty);

            Object.keys(this.viewport.chunks).forEach((chunkId) => {
                document.getElementById(chunkId).remove();
            });

            this.cells = {};
            this.setHealth(100);
            this.setScores(0);
            this.viewport.fieldX = 0;
            this.viewport.fieldY = 0;
            this.viewport.chunks = {};

            this.viewport.updateChunks();
            this.handleCellClick({x: 0, y: 0});
            this.saveState();
        }

        loadState() {
            const stateJson = window.localStorage.getItem("game_state_" + this.difficulty);
            const state = JSON.parse(stateJson);

            if (state) {
                this.cells = state.cells;
                this.setHealth(state.health);
                this.setScores(state.scores);

                Object.keys(this.cells).forEach((cellId) => {
                    const cell = this.cells[cellId];
                    if (cell.state !== cellStateUnknown) {
                        this.viewport.renderCell(cell);
                    }
                });
            }
        }

        saveState() {
            const state = {
                cells: this.cells,
                health: this.health,
                scores: this.scores,
                fieldX: this.viewport.fieldX,
                fieldY: this.viewport.fieldY,
            };

            window.localStorage.setItem("game_state_" + this.difficulty, JSON.stringify(state));
        }

        handleCellClick(location, isCascade) {
            if (this.health <= 0) {
                return;
            }

            const cellId = this.getCellIdFromLocation(location);

            this.cells[cellId] = this.getOrCreateCell(cellId);

            if (this.cells[cellId].state === cellStateUnknown) {
                if (this.cells[cellId].mined) {
                    this.cells[cellId].state = cellStateExplosion;
                    this.setHealth(this.health - 100);
                } else {
                    this.setHealth(this.health + healthGainPerCell);
                    this.setScores(this.scores + 1);
                    // Count near mined cells
                    let nearMinesCount = this.getNearMinesCount(location);

                    if (nearMinesCount === 0) {
                        this.cells[cellId].state = cellStateCounter0;
                        this.getNearLocations(location).forEach((nearLocation) => {
                            this.handleCellClick({
                                x: nearLocation.x,
                                y: nearLocation.y,
                            }, true)
                        });
                    } else if (nearMinesCount === 1) {
                        this.cells[cellId].state = cellStateCounter1;
                    } else if (nearMinesCount === 2) {
                        this.cells[cellId].state = cellStateCounter2;
                    } else if (nearMinesCount === 3) {
                        this.cells[cellId].state = cellStateCounter3;
                    } else if (nearMinesCount === 4) {
                        this.cells[cellId].state = cellStateCounter4;
                    } else if (nearMinesCount === 5) {
                        this.cells[cellId].state = cellStateCounter5;
                    } else if (nearMinesCount === 6) {
                        this.cells[cellId].state = cellStateCounter6;
                    } else if (nearMinesCount === 7) {
                        this.cells[cellId].state = cellStateCounter7;
                    } else if (nearMinesCount === 8) {
                        this.cells[cellId].state = cellStateCounter8;
                    }
                }
            } else if (this.cells[cellId].state === cellStateCounter1) {
                if (!isCascade) {
                    this.handleAutoClick(location);
                }
            } else if (this.cells[cellId].state === cellStateCounter2) {
                if (!isCascade) {
                    this.handleAutoClick(location);
                }
            } else if (this.cells[cellId].state === cellStateCounter3) {
                if (!isCascade) {
                    this.handleAutoClick(location);
                }
            } else if (this.cells[cellId].state === cellStateCounter4) {
                if (!isCascade) {
                    this.handleAutoClick(location);
                }
            } else if (this.cells[cellId].state === cellStateCounter5) {
                if (!isCascade) {
                    this.handleAutoClick(location);
                }
            } else if (this.cells[cellId].state === cellStateCounter6) {
                if (!isCascade) {
                    this.handleAutoClick(location);
                }
            } else if (this.cells[cellId].state === cellStateCounter7) {
                if (!isCascade) {
                    this.handleAutoClick(location);
                }
            } else if (this.cells[cellId].state === cellStateCounter8) {
                if (!isCascade) {
                    this.handleAutoClick(location);
                }
            }

            this.viewport.renderCell(this.cells[cellId]);
        }

        handleAutoClick(location) {
            const nearMinesCount = this.getNearMinesCount(location);
            const nearCoveredCount = this.getNearCoveredCount(location);
            const nearFlaggedCount = this.getNearFlaggedCount(location);
            const nearExplodedCount = this.getNearExplodedCount(location);

            if ((nearFlaggedCount + nearExplodedCount) >= nearMinesCount) {
                this.getNearLocations(location).forEach((nearLocation) => {
                    const nearCell = this.getOrCreateCell(
                        this.getCellIdFromLocation({
                            x: nearLocation.x,
                            y: nearLocation.y,
                        })
                    );

                    if (nearCell.state === cellStateUnknown || nearCell.state === cellStateQuestion) {
                        this.handleCellClick(nearLocation, true);
                    }
                });
            } else if ((nearCoveredCount + nearFlaggedCount + nearExplodedCount) === nearMinesCount) {
                this.getNearLocations(location).forEach((nearLocation) => {
                    const nearCell = this.getOrCreateCell(
                        this.getCellIdFromLocation({
                            x: nearLocation.x,
                            y: nearLocation.y,
                        })
                    );

                    if (nearCell.state === cellStateUnknown) {
                        this.handleCellMark(nearLocation);
                    }
                });
            }
        }

        getNearLocations(location) {
            let nearLocations = [];
            for (let xShift = -1; xShift <= 1; xShift++) {
                for (let yShift = -1; yShift <= 1; yShift++) {
                    if (xShift !== 0 || yShift !== 0) {
                        nearLocations.push({
                            x: location.x + xShift,
                            y: location.y + yShift,
                        });
                    }
                }
            }

            return nearLocations;
        }

        getNearCoveredCount(location) {
            let nearCoveredCount = 0;

            this.getNearLocations(location).forEach((nearLocation) => {
                const nearCell = this.getOrCreateCell(
                    this.getCellIdFromLocation({
                        x: nearLocation.x,
                        y: nearLocation.y,
                    })
                );

                if (nearCell.state === cellStateUnknown) {
                    nearCoveredCount++;
                }
            });

            return nearCoveredCount;
        }

        getNearExplodedCount(location) {
            let nearExplodedCount = 0;

            this.getNearLocations(location).forEach((nearLocation) => {
                const nearCell = this.getOrCreateCell(
                    this.getCellIdFromLocation({
                        x: nearLocation.x,
                        y: nearLocation.y,
                    })
                );

                if (nearCell.state === cellStateExplosion) {
                    nearExplodedCount++;
                }
            });

            return nearExplodedCount;
        }

        getNearFlaggedCount(location) {
            let nearFlaggedCount = 0;

            this.getNearLocations(location).forEach((nearLocation) => {
                const nearCell = this.getOrCreateCell(
                    this.getCellIdFromLocation({
                        x: nearLocation.x,
                        y: nearLocation.y,
                    })
                );

                if (nearCell.state === cellStateFlag) {
                    nearFlaggedCount++;
                }
            });

            return nearFlaggedCount;
        }

        getNearMinesCount(location) {
            let nearMinesCount = 0;

            this.getNearLocations(location).forEach((nearLocation) => {
                const nearCell = this.getOrCreateCell(
                    this.getCellIdFromLocation({
                        x: nearLocation.x,
                        y: nearLocation.y,
                    })
                );

                if (nearCell.mined) {
                    nearMinesCount++;
                }
            });

            return nearMinesCount;
        }

        handleClick(clickLocationInPixels) {
            const locationInCells = this.viewport.convertLocationFromPixelsToCells(clickLocationInPixels);

            this.handleCellClick(locationInCells);
        }

        handleMark(clickLocationInPixels) {
            const locationInCells = this.viewport.convertLocationFromPixelsToCells(clickLocationInPixels);

            this.handleCellMark(locationInCells);
        }

        handleCellMark(location) {
            if (this.health <= 0) {
                return;
            }

            const cellId = this.getCellIdFromLocation(location);

            this.cells[cellId] = this.getOrCreateCell(cellId);

            if (this.cells[cellId].state === cellStateUnknown) {
                this.cells[cellId].state = cellStateFlag;
            } else if (this.cells[cellId].state === cellStateFlag) {
                this.cells[cellId].state = cellStateQuestion;
            } else if (this.cells[cellId].state === cellStateQuestion) {
                this.cells[cellId].state = cellStateUnknown;
            }

            this.viewport.renderCell(this.cells[cellId]);
        }

        getOrCreateCell(cellId) {
            let cell = this.cells[cellId];

            if (cell === undefined) {
                const location = this.getCellLocationFromId(cellId);
                const firstClick = Object.keys(this.cells).length < firstSafeCells;

                cell = new Cell();
                cell.x = location.x;
                cell.y = location.y;
                cell.state = cellStateUnknown
                if (firstClick) {
                    // First click must be safe
                    cell.mined = false;
                } else {
                    cell.mined = Math.random() < minedPercent;
                }
            }

            this.cells[cellId] = cell;

            return this.cells[cellId];
        }

        getCellIdFromLocation(location) {
            return "cellId:" + location.x + "_" + location.y;
        }

        getCellLocationFromId(cellId) {
            const location = cellId.split(":")[1].split("_");
            return {
                x: parseInt(location[0]),
                y: parseInt(location[1]),
            }
        }
    }

    class Viewport {
        width;
        height;
        fieldX;
        fieldY;
        leftFromFieldCenter;
        rightFromFieldCenter;
        topFromFieldCenter;
        bottomFromFieldCenter;
        chunks;

        constructor() {
            this.width = window.innerWidth;
            this.height = window.innerHeight;
            this.fieldX = 0;
            this.fieldY = 0;
            this.leftFromFieldCenter = this.fieldX - Math.ceil(this.width / 2);
            this.rightFromFieldCenter = this.leftFromFieldCenter + this.width;
            this.topFromFieldCenter = this.fieldY - Math.ceil(this.height / 2);
            this.bottomFromFieldCenter = this.topFromFieldCenter + this.height;
            this.chunks = {};

            this.updateChunks();
        }

        convertLocationFromPixelsToCells(locationInPixels) {
            return {
                x: Math.ceil(
                    (locationInPixels.x + this.fieldX - (Math.ceil(cellWidthInPixels / 2)))
                    / cellWidthInPixels
                ),
                y: Math.ceil(
                    (locationInPixels.y + this.fieldY - (Math.ceil(cellHeightInPixels / 2)))
                    / cellHeightInPixels
                ),
            }
        }

        move(delta) {
            this.fieldX -= delta.x;
            this.fieldY -= delta.y;

            Object.keys(this.chunks).forEach((chunkId) => {
                const chunk = this.chunks[chunkId];
                chunk.style.left = (parseInt(chunk.style.left) + delta.x) + "px";
                chunk.style.top = (parseInt(chunk.style.top) + delta.y) + "px";
            });
        }

        renderCell(cell) {
            // Calculate chunk to attach
            const chunkLocation = this.getChunkLocationByCellLocation({
                x: cell.x,
                y: cell.y,
            })

            const xDirectionCoefficient = cell.x > 0 ? 1 : -1;
            const yDirectionCoefficient = cell.y > 0 ? 1 : -1;

            const relativeCellXInPixels = (((cell.x + (chunkLocation.x * chunkWidthInCells * xDirectionCoefficient))
                + Math.floor(chunkWidthInCells / 2)) * cellWidthInPixels) % chunkWidthInPixels;
            const relativeCellYInPixels = (((cell.y + (chunkLocation.y * chunkHeightInCells * yDirectionCoefficient))
                + Math.floor(chunkHeightInCells / 2)) * cellHeightInPixels) % chunkHeightInPixels;

            const chunk = this.getOrCreateChunk(chunkLocation);

            let image;
            // const R = Math.ceil((Math.random() + 0.3) * 196);
            // const G = Math.ceil((Math.random() + 0.3) * 196);
            // const B = Math.ceil((Math.random() + 0.3) * 196);
            // const randomColor = "rgba("+R+", "+G+", "+B+", .4)";

            if (cell.state === cellStateExplosion) {
                image = this.drawSymbol("☠️", "rgba(255, 255, 255, 1)", "rgb(7,7,7)");
            } else if (cell.state === cellStateFlag) {
                image = this.drawSymbol("🚩", "rgba(255, 0, 0, 1)", "rgb(7,7,7)");
            } else if (cell.state === cellStateQuestion) {
                image = this.drawSymbol("?", "rgb(115,146,252)", "rgb(7,7,7)");
            } else if (cell.state === cellStateUnknown) {
                image = this.drawSymbol(" ", "rgba(60, 60, 60, 1)", "rgb(7,7,7)");
            } else if (cell.state === cellStateCounter0) {
                image = this.drawSymbol(" ", "rgba(0, 0, 0, 1)", "rgb(136,136,136)");
            } else if (cell.state === cellStateCounter1) {
                image = this.drawSymbol("1", "rgba(0, 0, 153, 1)", "rgba(147, 147, 147, 1)");
            } else if (cell.state === cellStateCounter2) {
                image = this.drawSymbol("2", "rgba(0, 119, 0, 1)", "rgba(147, 147, 147, 1)");
            } else if (cell.state === cellStateCounter3) {
                image = this.drawSymbol("3", "rgba(170, 0, 0, 1)", "rgba(147, 147, 147, 1)");
            } else if (cell.state === cellStateCounter4) {
                image = this.drawSymbol("4", "rgba(153, 0, 153, 1)", "rgba(147, 147, 147, 1)");
            } else if (cell.state === cellStateCounter5) {
                image = this.drawSymbol("5", "rgba(102, 0, 0, 1)", "rgba(147, 147, 147, 1)");
            } else if (cell.state === cellStateCounter6) {
                image = this.drawSymbol("6", "rgba(0, 153, 153, 1)", "rgba(147, 147, 147, 1)");
            } else if (cell.state === cellStateCounter7) {
                image = this.drawSymbol("7", "rgba(0, 0, 0, 1)", "rgba(147, 147, 147, 1)");
            } else if (cell.state === cellStateCounter8) {
                image = this.drawSymbol("8", "rgba(255, 255, 255, 1)", "rgba(147, 147, 147, 1)");
            } else {
                image = this.drawSymbol(" ", "rgba(255, 0, 0, 1)", "rgba(147, 147, 147, 1)");
            }

            const context2D = chunk.getContext("2d");
            context2D.drawImage(image, relativeCellXInPixels, relativeCellYInPixels);
        }

        drawSymbol(symbol, symbolStyle, backgroundStyle) {
            const canvas = document.createElement("canvas");
            canvas.width = chunkWidthInPixels;
            canvas.height = chunkHeightInPixels;

            const context2D = canvas.getContext("2d");

            if (backgroundStyle) {
                context2D.fillStyle = backgroundStyle;
                context2D.fillRect(0, 0, cellSizeInPixels, cellWidthInPixels);
            }

            context2D.font = "bold " + Math.ceil(cellSizeInPixels * 0.8) + "px/1 sans-serif";
            if (symbolStyle) {
                context2D.fillStyle = symbolStyle;
            }
            context2D.textBaseline = "middle";
            context2D.textAlign = "center";
            context2D.fillText(symbol, Math.ceil(cellWidthInPixels * 0.5), Math.ceil(cellHeightInPixels * 0.525));

            return canvas;
        }

        getOrCreateChunk(location) {
            const chunkId = this.getChunkIdByLocation(location)

            if (!(this.chunks[chunkId])) {
                const chunk = document.createElement("canvas");
                chunk.id = chunkId;
                chunk.width = chunkWidthInPixels;
                chunk.height = chunkHeightInPixels;
                chunk.style.position = "fixed";
                chunk.style.left = (
                    (location.x * chunkWidthInPixels)
                    - this.fieldX
                    + (Math.ceil(this.width / 2))
                    - (Math.ceil(chunkWidthInPixels / 2))
                ) + "px";
                chunk.style.top = (
                    (location.y * chunkHeightInPixels)
                    - this.fieldY
                    + (Math.ceil(this.height / 2))
                    - (Math.ceil(chunkHeightInPixels / 2))
                ) + "px";

                const context2D = chunk.getContext("2d");

                const R = Math.ceil((Math.random()) * 45);
                const G = Math.ceil((Math.random()) * 45);
                const B = Math.ceil((Math.random()) * 45);
                context2D.fillStyle = "rgba(" + R + ", " + G + ", " + B + ", 1)";
                context2D.fillRect(0, 0, chunkWidthInPixels, chunkHeightInPixels);

                const viewport = document.getElementById("viewport");
                viewport.append(chunk);

                this.chunks[chunkId] = chunk;
            }

            return this.chunks[chunkId];
        }

        updateChunks() {
            // calculate visible chunks
            const leftChunkNumber = Math.floor((this.leftFromFieldCenter + this.fieldX) / chunkWidthInPixels);
            const rightChunkNumber = Math.ceil((this.rightFromFieldCenter + this.fieldX) / chunkWidthInPixels);
            const topChunkNumber = Math.floor((this.topFromFieldCenter + this.fieldY) / chunkHeightInPixels);
            const bottomChunkNumber = Math.ceil((this.bottomFromFieldCenter + this.fieldY) / chunkHeightInPixels);

            let visibleChunkIds = [];
            for (let chunkX = leftChunkNumber; chunkX <= rightChunkNumber; chunkX++) {
                for (let chunkY = topChunkNumber; chunkY <= bottomChunkNumber; chunkY++) {
                    visibleChunkIds.push(this.getChunkIdByLocation({x: chunkX, y: chunkY}));
                }
            }

            // show hidden
            visibleChunkIds.forEach((chunkId) => {
                if (this.chunks[chunkId] !== undefined) {
                    this.chunks[chunkId].style.display = "block";
                }
            });

            // create missing
            visibleChunkIds.forEach((chunkId) => {
                const numberXY = chunkId.split(":")[1].split("_");
                const numberX = parseInt(numberXY[0]);
                const numberY = parseInt(numberXY[1]);

                this.getOrCreateChunk({x: numberX, y: numberY});
            });

            // hide overflowing
        }

        getFieldLocationByClickLocation(clickLocation) {
            return {
                x: this.leftFromFieldCenter + clickLocation.x,
                y: this.topFromFieldCenter + clickLocation.y,
            };
        }

        getChunkLocationByCellLocation(cellLocation) {
            return {
                x: Math.ceil((cellLocation.x - Math.floor(chunkWidthInCells  / 2)) / chunkWidthInCells),
                y: Math.ceil((cellLocation.y - Math.floor(chunkHeightInCells / 2)) / chunkHeightInCells),
            };
        }

        getChunkIdByLocation(location) {
            return "chunkId:" + parseInt(location.x) + "_" + parseInt(location.y)
        }
    }

    class Cell {
        x;
        y;
        state;
        mined;
    }

    new Game();
})();
