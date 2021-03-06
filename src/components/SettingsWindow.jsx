import React, { PureComponent } from "react";
import Titlebar from './Titlebar'
import Slider from "./Slider";
import { DragDropContext, Droppable, Draggable } from "react-beautiful-dnd";
import { markdown } from 'markdown';

const reorder = (list, startIndex, endIndex) => {
    const result = Array.from(list);
    const [removed] = result.splice(startIndex, 1);
    result.splice(endIndex, 0, removed);
    return result;
};

const getItemStyle = (isDragging, draggableStyle) => ({
    userSelect: "none",
    background: isDragging ? "rgba(122, 122, 122, 0.2)" : "none",
    ...draggableStyle
});

const monitorSort = (a, b) => {
    const aSort = (a.order === undefined ? 999 : a.order * 1)
    const bSort = (b.order === undefined ? 999 : b.order * 1)
    return aSort - bSort
}

export default class SettingsWindow extends PureComponent {

    constructor(props) {
        super(props)
        this.state = {
            activePage: 'general',
            theme: 'default',
            openAtLogin: false,
            monitors: [],
            remaps: [],
            names: [],
            adjustmentTimes: [],
            linkedLevelsActive: false,
            updateInterval: (window.settings.updateInterval || 500),
            downloadingUpdate: false,
            checkForUpdates: false,
            adjustmentTimeIndividualDisplays: false
        }
        this.lastLevels = []
        this.onDragEnd = this.onDragEnd.bind(this);
    }

    componentDidMount() {
        window.addEventListener("monitorsUpdated", this.recievedMonitors)
        window.addEventListener("settingsUpdated", this.recievedSettings)

        if (window.isAppX === false) {
            fetch("https://api.github.com/repos/xanderfrangos/twinkle-tray/releases").then((response) => {
                response.json().then((json) => {
                    this.setState({
                        releaseURL: (window.isAppX ? "ms-windows-store://pdp/?productid=9PLJWWSV01LK" : json[0].html_url),
                        latest: json[0].tag_name,
                        downloadURL: json[0].assets[0]["browser_download_url"],
                        changelog: json[0].body
                    })
                })
            });
        }

    }


    onDragEnd(result) {
        // dropped outside the list
        if (!result.destination) {
            return;
        }
        const sorted = this.state.monitors.slice(0).sort(monitorSort)
        const items = reorder(
            sorted,
            result.source.index,
            result.destination.index
        );

        let order = []
        let idx = 0
        for (let monitor of items) {
            this.state.monitors[monitor.num].order = idx
            order.push({
                id: monitor.id,
                order: idx
            })
            idx++
        }

        this.setState({
            order
        });

        window.sendSettings({ order })
    }



    getRemap = (name) => {
        if (this.state.remaps[name] === undefined) {
            return {
                min: 0,
                max: 100
            }
        }
        return this.state.remaps[name]
    }


    minMaxChanged = (value, slider) => {

        const name = slider.props.monitorName
        let remaps = Object.assign({}, this.state.remaps)

        if (remaps[name] === undefined) {
            remaps[name] = {
                min: 0,
                max: 100
            }
        }

        if (slider.props.type == "min") {
            remaps[name].min = value


            // Keep within 10%, cap

            if (remaps[name].min > remaps[name].max - 10) {
                remaps[name].max = remaps[name].min + 10
            }

            if (remaps[name].max > 100) {
                remaps[name].max = 100
            }

            if (remaps[name].min > remaps[name].max - 10) {
                remaps[name].min = remaps[name].max - 10
            }

        } else if (slider.props.type == "max") {
            remaps[name].max = value

            // Keep within 10%, cap

            if (remaps[name].min > remaps[name].max - 10) {
                remaps[name].min = remaps[name].max - 10
            }

            if (remaps[name].min < 0) {
                remaps[name].min = 0
            }

            if (remaps[name].min > remaps[name].max - 10) {
                remaps[name].max = remaps[name].min + 10
            }
        }

        this.setState({ remaps })
        window.sendSettings({ remaps })
        //window.requestSettings()
    }

    themeChanged = (event) => {
        this.setState({ theme: event.target.value })
        window.sendSettings({ theme: event.target.value })
    }

    updateIntervalChanged = (event) => {
        this.setState({ updateInterval: event.target.value * 1 })
        window.sendSettings({ updateInterval: event.target.value * 1 })
    }

    startupChanged = (event) => {
        const openAtLogin = (this.state.openAtLogin ? false : true)
        this.setState({ openAtLogin })
        window.sendSettings({ openAtLogin })
    }

    ramChanged = (event) => {
        const killWhenIdle = (this.state.killWhenIdle ? false : true)
        this.setState({ killWhenIdle })
        window.sendSettings({ killWhenIdle })
    }
    checkTimeAtStartupChanged = (event) => {
        const checkTimeAtStartup = (this.state.checkTimeAtStartup ? false : true)
        this.setState({ checkTimeAtStartup })
        window.sendSettings({ checkTimeAtStartup })
    }

    monitorNameChange = (e, f) => {
        const idx = e.currentTarget.dataset.key
        this.state.names[window.allMonitors[idx].id] = e.currentTarget.value
        this.forceUpdate()
        window.sendSettings({ names: this.state.names })
    }

    getMonitorName = (monitor, renames) => {
        if (Object.keys(renames).indexOf(monitor.id) >= 0 && renames[monitor.id] != "") {
            return renames[monitor.id] + ` (${monitor.name})`
        } else {
            return monitor.name
        }
    }

    getSidebar = () => {
        const items = [
            {
                id: "general",
                label: "General",
                icon: "&#xE713;"
            },
            {
                id: "monitors",
                label: "Monitor Settings",
                icon: "&#xE7F4;"
            },
            {
                id: "time",
                label: "Time Adjustments",
                icon: "&#xE823;"
            },
            {
                id: "hotkeys",
                label: "Hotkeys",
                icon: "&#xF210;"
            },
            {
                id: "updates",
                label: "Updates",
                icon: "&#xE895;"
            }
        ]
        return items.map((item, index) => {
            return (<div key={item.id} className="item" data-active={this.isSection(item.id)} onClick={() => { this.setState({ activePage: item.id }); window.requestMonitors(); }}>
                <div className="icon" dangerouslySetInnerHTML={{ __html: (item.icon || "&#xE770;") }}></div><div className="label">{item.label || `Item ${index}`}</div>
            </div>)
        })
    }


    getUpdate = () => {
        if (window.isAppX) {
            return (
                <p>To check for updates, visit the <a onClick={() => { window.openURL("ms-windows-store://pdp/?productid=9PLJWWSV01LK") }}>Microsoft Store app</a>.</p>
            )
        } else {
            if (this.state.latest && this.state.latest != window.version) {
                return (
                    <div>
                        <p><b style={{ color: window.accent }}>An update is available for Twinkle Tray!</b></p>
                        <div className="changelog" dangerouslySetInnerHTML={{ __html: markdown.toHTML(this.state.changelog) }}></div>
                        <br />
                        {this.getUpdateButton()}
                    </div>
                )
            } else if (this.state.latest) {
                return (
                    <div>
                        <p>There are no updates available at this time. This version of Twinkle tray includes the following changes:</p>
                        <div className="changelog" dangerouslySetInnerHTML={{ __html: markdown.toHTML(this.state.changelog) }}></div>
                    </div>
                )
            }
        }
    }

    getUpdateButton = () => {
        if (this.state.downloadingUpdate) {
            return (<p><b>Downloading update...</b></p>)
        } else {
            return (<a className="button" onClick={() => { window.getUpdate(this.state.downloadURL); this.setState({ downloadingUpdate: true }) }}>Download &amp; Install {this.state.latest}</a>)
        }
    }

    getMinMaxMonitors = () => {
        if (this.state.monitors == undefined || this.state.monitors.length == 0) {
            return (<div className="no-displays-message">No compatible displays found. Please check that "DDC/CI" is enabled for your monitors.<br /><br /></div>)
        } else {
            return this.state.monitors.map((monitor, index) => {
                const remap = this.getRemap(monitor.name)
                return (
                    <div key={monitor.name}>
                        <br />
                        <div className="sectionSubtitle"><div className="icon">&#xE7F4;</div><div>{this.getMonitorName(monitor, this.state.names)}</div></div>
                        <label>Min</label>
                        <Slider key={monitor.name + ".min"} type="min" level={remap.min} monitorName={monitor.name} monitortype={monitor.type} onChange={this.minMaxChanged} scrolling={false} />
                        <label>Max</label>
                        <Slider key={monitor.name + ".max"} type="max" level={remap.max} monitorName={monitor.name} monitortype={monitor.type} onChange={this.minMaxChanged} scrolling={false} />
                    </div>

                )
            })
        }
    }

    getRenameMonitors = () => {
        if (this.state.monitors == undefined || this.state.monitors.length == 0) {
            return (<div className="no-displays-message">No displays found.<br /><br /></div>)
        } else {
            return this.state.monitors.map((monitor, index) => (
                <div key={index}>
                    <br />
                    <div className="sectionSubtitle"><div className="icon">&#xE7F4;</div><div>{monitor.name}</div></div>
                    <input type="text" placeholder="Enter name" data-key={index} onChange={this.monitorNameChange} value={(this.state.names[monitor.id] ? this.state.names[monitor.id] : "")}></input>
                </div>

            ))
        }
    }


    getReorderMonitors = () => {
        if (this.state.monitors == undefined || this.state.monitors.length == 0) {
            return (<div className="no-displays-message">No displays found.<br /><br /></div>)
        } else {
            const sorted = this.state.monitors.slice(0).sort(monitorSort)
            return (
                <DragDropContext onDragEnd={this.onDragEnd}>
                    <Droppable droppableId="droppable">
                        {(provided, snapshot) => (
                            <div
                                {...provided.droppableProps}
                                ref={provided.innerRef}
                            >
                                {sorted.map((monitor, index) => (
                                    <Draggable key={monitor.id} draggableId={monitor.id} index={index}>
                                        {(provided, snapshot) => (
                                            <div
                                                ref={provided.innerRef}
                                                {...provided.draggableProps}
                                                {...provided.dragHandleProps}
                                                style={getItemStyle(
                                                    snapshot.isDragging,
                                                    provided.draggableProps.style
                                                )}
                                            >
                                                <div className="sectionSubtitle"><div className="icon">&#xE7F4;</div><div>{this.getMonitorName(monitor, this.state.names)}</div></div>
                                            </div>
                                        )}
                                    </Draggable>
                                ))}
                                {provided.placeholder}
                            </div>
                        )}
                    </Droppable>
                </DragDropContext>
            )

        }
    }

    getAdjustmentTimes = () => {
        if (this.state.adjustmentTimes == undefined || this.state.adjustmentTimes.length == 0) {
            return (<div></div>)
        } else {
            return this.state.adjustmentTimes.map((time, index) => (
                <div className="item" key={index}>
                    <div className="row">
                        <select onChange={(e) => {
                            this.setAdjustmentTimeValue(index, e.target.value, "hour")
                        }} value={time.hour}>
                            <option>1</option>
                            <option>2</option>
                            <option>3</option>
                            <option>4</option>
                            <option>5</option>
                            <option>6</option>
                            <option>7</option>
                            <option>8</option>
                            <option>9</option>
                            <option>10</option>
                            <option>11</option>
                            <option>12</option>
                        </select>
                        <select onChange={(e) => {
                            this.setAdjustmentTimeValue(index, e.target.value, "minute")
                        }} value={time.minute}>
                            <option value="0">00</option>
                            <option>15</option>
                            <option>30</option>
                            <option>45</option>
                        </select>
                        <select onChange={(e) => {
                            this.setAdjustmentTimeValue(index, e.target.value, "am")
                        }} value={time.am}>
                            <option>AM</option>
                            <option>PM</option>
                        </select>
                        <a className="button" onClick={() => {
                            this.state.adjustmentTimes.splice(index, 1)
                            this.forceUpdate()
                            this.adjustmentTimesUpdated()
                        }}>Remove time</a>
                    </div>
                    <div className="row">
                        { this.getAdjustmentTimesMonitors(time, index) }
                        
                    </div>
                </div>
            ))
        }

    }

    getAdjustmentTimesMonitors = (time, index) => {
        if(this.state.adjustmentTimeIndividualDisplays) {
            return this.state.monitors.map((monitor, idx) => {
                let level = time.brightness
                if(this.state.adjustmentTimes[index] && this.state.adjustmentTimes[index].monitors && this.state.adjustmentTimes[index].monitors[monitor.id]) {
                    level = this.state.adjustmentTimes[index].monitors[monitor.id]
                } 
                return (<Slider key={monitor.id + ".brightness"} name={this.getMonitorName(monitor, this.state.names)} onChange= { (value) => { this.getAdjustmentTimesMonitorsChanged(index, monitor, value) }} level={level} scrolling={false} />)
            })
        } else {
            return (<Slider key={index + ".brightness"} name="All Displays" level={time.brightness} onChange={(value, slider) => { this.state.adjustmentTimes[index].brightness = value; this.forceUpdate(); this.adjustmentTimesUpdated() }} scrolling={false} />)
        }
    }

    getAdjustmentTimesMonitorsChanged = (index, monitor, value) => {
        if(this.state.adjustmentTimes[index].monitors === undefined) {
            this.state.adjustmentTimes[index].monitors = {}
        }
        this.state.adjustmentTimes[index].monitors[monitor.id] = value
        console.log(this.state.adjustmentTimes[index].monitors)
        this.forceUpdate();
        this.adjustmentTimesUpdated()
    }


    setAdjustmentTimeValue = (index, value, type) => {
        this.state.adjustmentTimes[index][type] = value
        this.forceUpdate()
        this.adjustmentTimesUpdated()
    }







    // Update monitor info
    recievedMonitors = (e) => {
        if (this.state.monitors.length > 0 || e.detail.length > 0) {
            this.setState({
                monitors: e.detail
            })
        }
        this.forceUpdate()
    }

    // Update settings
    recievedSettings = (e) => {
        const settings = e.detail
        const linkedLevelsActive = (settings.linkedLevelsActive || false)
        const updateInterval = (settings.updateInterval || 500) * 1
        const remaps = (settings.remaps || {})
        const names = (settings.names || {})
        const adjustmentTimes = (settings.adjustmentTimes || {})
        const killWhenIdle = (settings.killWhenIdle || false)
        const order = (settings.order || [])
        const checkTimeAtStartup = (settings.checkTimeAtStartup || false)
        const checkForUpdates = (settings.checkForUpdates || false)
        const adjustmentTimeIndividualDisplays = (settings.adjustmentTimeIndividualDisplays || false)
        this.setState({
            linkedLevelsActive,
            remaps,
            updateInterval,
            names,
            adjustmentTimes,
            killWhenIdle,
            order,
            checkTimeAtStartup,
            checkForUpdates,
            adjustmentTimeIndividualDisplays
        }, () => {
            this.forceUpdate()
        })
    }


    isSection = (name) => {
        if (this.state.activePage == name) {
            return true
        } else {
            return false
        }
    }

    addAdjustmentTime = () => {
        this.state.adjustmentTimes.push({
            brightness: 50,
            hour: '12',
            minute: '30',
            am: "PM",
            monitors: {}
        })
        this.forceUpdate()
        this.adjustmentTimesUpdated()
    }

    adjustmentTimesUpdated = () => {
        window.sendSettings({ adjustmentTimes: this.state.adjustmentTimes })
    }


    render() {
        return (
            <div className="window-base" data-theme={window.settings.theme || "default"}>
                <Titlebar title="Twinkle Tray Settings" />
                <div id="sidebar">
                    {this.getSidebar()}
                </div>
                <div id="page">
                    <div className="pageSection" data-active={this.isSection("general")}>
                        <div className="sectionTitle">General</div>
                        <label>Launch at startup</label>
                        <input onChange={this.startupChanged} checked={window.settings.openAtLogin || false} data-checked={window.settings.openAtLogin || false} type="checkbox" />
                        <br /><br />
                        <label>App Theme</label>
                        <select value={window.settings.theme} onChange={this.themeChanged}>
                            <option value="default">System Preference (Default)</option>
                            <option value="dark">Dark Mode</option>
                            <option value="light">Light Mode</option>
                        </select>
                    </div>
                    <div className="pageSection" data-active={this.isSection("general")}>
                        <div className="sectionTitle">Reset Settings</div>
                        <p>If for some reason you need to clear your settings, hit this button.</p>
                        <br />
                        <a className="button" onClick={window.resetSettings}>Reset settings</a>
                    </div>




                    <div className="pageSection" data-active={this.isSection("time")}>
                        <div className="sectionTitle">Time of Day Adjustments</div>
                        <p>Automatically set your monitors to a specific brightness level at a desired time. All monitors will be set to the same, normalized levels.</p>
                        <p><br /><a className="button" onClick={this.addAdjustmentTime}>+ Add a time</a></p>
                        <div className="adjustmentTimes">
                            {this.getAdjustmentTimes()}
                        </div>
                    </div>
                    <div className="pageSection" data-active={this.isSection("time")}>
                        <label>Set brightness for individual displays</label>
                        <p>Configure the brightness per display instead of for all displays at once</p>
                        <input onChange={() => {
                            const adjustmentTimeIndividualDisplays = (this.state.adjustmentTimeIndividualDisplays ? false : true)
                            this.setState({ adjustmentTimeIndividualDisplays })
                            window.sendSettings({ adjustmentTimeIndividualDisplays })
                        }} checked={window.settings.adjustmentTimeIndividualDisplays || false} data-checked={window.settings.adjustmentTimeIndividualDisplays || false} type="checkbox" />
                    </div>
                    <div className="pageSection" data-active={this.isSection("time")}>
                        <label>Check at app startup</label>
                        <p>Adjust the brightness to match the most relevant time when Twinkle Tray starts.</p>
                        <input onChange={this.checkTimeAtStartupChanged} checked={window.settings.checkTimeAtStartup || false} data-checked={window.settings.checkTimeAtStartup || false} type="checkbox" />
                    </div>




                    <div className="pageSection" data-active={this.isSection("monitors")}>
                        <div className="sectionTitle">Brightness update rate</div>
                        <p>How often the brightness will be updated on your displays as you're adjusting their values. Increase the time if your displays are flickering.</p>
                        <select value={this.state.updateInterval} onChange={this.updateIntervalChanged}>
                            <option value="999">Ludicrous</option>
                            <option value="250">Fast (250 ms)</option>
                            <option value="500">Normal (500 ms)</option>
                            <option value="1000">Slow (1 second)</option>
                            <option value="2000">Very Slow (2 seconds)</option>
                        </select>
                    </div>
                    <div className="pageSection" data-active={this.isSection("monitors")}>
                        <div className="sectionTitle">Rename Monitors</div>
                        <p>If you'd prefer a different name for each monitor (ex "Left Monitor", "Middle Monitor"), you can enter it below. Leaving the field empty will restore the original name.</p>
                        {this.getRenameMonitors()}
                    </div>
                    <div className="pageSection" data-active={this.isSection("monitors")}>
                        <div className="sectionTitle">Reorder Monitors</div>
                        <p>Change the order that monitors are displayed in the tray. Click and drag to make changes.</p>
                        <div className="reorderList">
                            {this.getReorderMonitors()}
                        </div>
                    </div>
                    <div className="pageSection" data-active={this.isSection("monitors")}>
                        <div className="sectionTitle">Normalize Brightness</div>
                        <p>Monitors often have different brightness ranges. By limiting the minimum/maximum brightness per display, the brightness levels between displays is much more consistent. Similar monitors will use the same settings.</p>
                        <div className="monitorItem">
                            {this.getMinMaxMonitors()}
                        </div>
                    </div>




                    <div className="pageSection" data-active={this.isSection("hotkeys")}>
                        <div className="sectionTitle">Brightness level adjustment</div>
                        <p>How much the brightness should be adjusted when using hotkeys.</p>
                        <select value={this.state.hotkeyPercent} onChange={ (e) => { this.setState({ hotkeyPercent: e.target.value * 1 }); window.sendSettings({ hotkeyPercent: e.target.value * 1 }) } }>
                            <option value="5">5%</option>
                            <option value="10">10%</option>
                            <option value="15">15%</option>
                            <option value="20">20%</option>
                            <option value="25">25%</option>
                            <option value="30">30%</option>
                        </select>
                    </div>




                    <div className="pageSection" data-active={this.isSection("updates")}>
                        <div className="sectionTitle">Updates</div>
                        <p>Your version of Twinkle Tray is <b>{window.version || "not available"}</b>.</p>
                        {this.getUpdate()}
                    </div>
                    <div className="pageSection" data-active={this.isSection("updates")} style={{ display: (window.isAppX ? "none" : (this.isSection("updates") ? "block" : "none")) }}>
                        <label>Automatically check for updates</label>
                        <p>Twinkle Tray will occasionally check for updates automatically and notify you in the brightness panel.</p>
                        <input onChange={() => {
                            const checkForUpdates = (this.state.checkForUpdates ? false : true)
                            this.setState({ checkForUpdates })
                            window.sendSettings({ checkForUpdates })
                        }} checked={window.settings.checkForUpdates || false} data-checked={window.settings.checkForUpdates || false} type="checkbox" />
                    </div>
                </div>
            </div>

        );
    }
}
