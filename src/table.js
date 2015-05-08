var React = require('react');
var $ = require('jQuery');

var RowComponent = require('./row');
var Dispatcher = require('./dispatcher');
var Helpers = require('./helpers');

var TableComponent = React.createClass({

    /**
     * React 'getInitialState' method
     */
    getInitialState: function() {
        var initialData = this.props.initialData || {};

        if (!initialData.rows) {
            initialData.rows = [];

            for (var i = 0; i < this.props.config.rows; i = i + 1) {
                initialData.rows[i] = [];
                for (var ci = 0; ci < this.props.config.columns; ci = ci + 1) {
                    initialData.rows[i][ci] = '';
                }
            }
        }

        return {
            data: initialData,
            selected: null,
            lastBlurred: null,
            selectedElement: null,
            editing: false
        };
    },

    /**
     * React 'componentWillMount' method
     */
    componentWillMount: function () {
        this.bindKeyboard();

        Dispatcher.subscribe('cellBlurred', cell => {
            this.setState({ 
                editing: false,
                lastBlurred: cell
            });
        });
    },

    /**
     * React Render method
     * @return {[JSX]} [JSX to render]
     */
    render: function() {
        var data = this.state.data,
            config = this.props.config,
            rows = [], key, i;

        // Sanity checks
        if (!data.rows && !config.rows) {
            return console.error('Table Component: Number of colums not defined in both data and config!');
        }

        // Create Rows
        for (i = 0; i < data.rows.length; i = i + 1) {
            key = 'row_' + i;
            rows.push(<RowComponent cells={data.rows[i]} 
                                    uid={i}
                                    key={key}
                                    config={config}
                                    selected={this.state.selected}
                                    editing={this.state.editing}
                                    handleSelectCell={this.handleSelectCell}
                                    handleDoubleClickOnCell={this.handleDoubleClickOnCell}
                                    onCellValueChange={this.handleCellValueChange} />);
        }

        return (
            <table>
                <tbody>
                    {rows}
                </tbody>
            </table>
        );
    },

    /**
     * Binds the various keyboard events dispatched to table functions
     */
    bindKeyboard: function () {
        Dispatcher.setupKeyboardShortcuts();

        Dispatcher.subscribe('up_keyup', () => {
            this.navigateTable('up');
        });
        Dispatcher.subscribe('down_keyup', () => {
            this.navigateTable('down');
        });
        Dispatcher.subscribe('left_keyup', () => {
            this.navigateTable('left');
        });
        Dispatcher.subscribe('right_keyup', () => {
            this.navigateTable('right');
        });
        Dispatcher.subscribe('tab_keyup', () => {
            this.navigateTable('right', null, true);
        });
        
        // Prevent brower's from jumping to URL bar
        Dispatcher.subscribe('tab_keydown', data => {
            if ($(document.activeElement) && $(document.activeElement)[0].tagName === 'INPUT') {
                if (data.preventDefault) {
                    data.preventDefault();
                } else {
                    // Oh, old IE, you 💩
                    data.returnValue = false;
                } 
            } 
        });

        Dispatcher.subscribe('remove_keydown', data => {
            if (!$(data.target).is('input, textarea')) {
                if (data.preventDefault) {
                    data.preventDefault();
                } else {
                    // Oh, old IE, you 💩
                    data.returnValue = false;
                }
            }
        });

        // Go into edit mode when the user starts typing on a field
        Dispatcher.subscribe('letter_keyup', () => {
            if (!this.state.editing && this.state.selectedElement) {
                this.setState({editing: true});
            }
        });

        // Delete on backspace and delete
        Dispatcher.subscribe('remove_keyup', () => {
            if (this.state.selected && !Helpers.equalCells(this.state.selected, this.state.lastBlurred)) {
                this.handleCellValueChange(this.state.selected, '');
            }
        });
    },

    /**
     * Navigates the table and moves selection
     * @param  {[string]} direction                               [Direction ('up' || 'down' || 'left' || 'right')]
     * @param  {[Array: [number: row, number: cell]]} originCell  [Origin Cell]
     * @param  {[boolean]} inEdit                                 [Currently editing]
     */
    navigateTable: function (direction, originCell, inEdit) {
        // Only traverse the table if the user isn't editing a cell,
        // unless override is given
        if (!inEdit && this.state.editing) {
            return false;
        }

        // Use the curently active cell if one isn't passed
        if (!originCell) {
            originCell = this.state.selectedElement;
        }

        var $origin = $(originCell),
            cellIndex = $origin.index(),
            target;

        if (direction === 'up') {
            target = $origin.closest('tr').prev().children().eq(cellIndex).find('span');
        } else if (direction === 'down') {
            target = $origin.closest('tr').next().children().eq(cellIndex).find('span');
        } else if (direction === 'left') {
            target = $origin.closest('td').prev().find('span');
        } else if (direction === 'right') {
            target = $origin.closest('td').next().find('span');
        }

        if (target.length > 0) {
            target.click();
        } else {
            this.extendTable(direction, originCell);
        }
    },

    /**
     * Extends the table with an additional row/column, if permitted by config
     * @param  {[string]} direction [Direction ('up' || 'down' || 'left' || 'right')]
     */
    extendTable: function (direction) {
        var config = this.props.config,
            data = this.state.data,
            newRow, i;

        if (direction === 'down' && config.canAddRow) {
            newRow = [];

            for (i = 0; i < this.state.data.rows[0].length; i = i + 1) {
                newRow[i] = '';
            }

            data.rows.push(newRow);
            return this.setState({data: data});
        }

        if (direction === 'right' && config.canAddColumn) {
            for (i = 0; i < data.rows.length; i = i + 1) {
                data.rows[i].push([]);
            }

            return this.setState({data: data});
        }

    },

    /**
     * Callback for 'selectCell', updating the selected Cell
     * @param  {[Array: [number: row, number: cell]]} cell [Selected Cell]
     * @param  {[object]} cellElement [Selected Cell Element]
     */
    handleSelectCell: function (cell, cellElement) {
        Dispatcher.publish('cellSelected', cell);
        this.setState({
            selected: cell,
            selectedElement: cellElement
        });
    },

    /**
     * Callback for 'cellValueChange', updating the cell data
     * @param  {[Array: [number: row, number: cell]]} cell [Selected Cell]
     * @param  {[object]} newValue                         [Value to set]
     */
    handleCellValueChange: function (cell, newValue) {
        Dispatcher.publish('cellValueChanged', cell, newValue);

        var data = this.state.data,
            row = cell[0],
            column = cell[1];

        data.rows[row][column] = newValue;
        this.setState({
            data: data
        });

        Dispatcher.publish('dataChanged', data);
    },

    /**
     * Callback for 'doubleClickonCell', enabling 'edit' mode
     */
    handleDoubleClickOnCell: function () {
        this.setState({
            editing: true
        });
    }
});

module.exports = TableComponent;