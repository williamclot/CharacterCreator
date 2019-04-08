import React, { Component, createRef } from 'react'
import classNames from 'classnames'

import styles from './index.module.css'

const defaultProps = {
    step: 1,
    min: -100,
    max:  100,
    precision: 3,

    /** @type { Formatter } */
    formatter: {
        format: number => number,
        parse: text => text
    }
}

export default class NumberInput extends Component {
    constructor( props ) {
        super( props )

        this.state = {
            isSelected: false,
            localValue: '',

            distance: 0,

            onMouseDownValue: 0,

            pointerX: 0,
            pointerY: 0,
            prevPointerX: 0,
            prevPointerY: 0,
        }

        this.inputRef = createRef()
    }

    componentDidMount() {
        // document.addEventListener( 'mouseup', this.onMouseUp )
        // document.addEventListener( 'mousemove', this.onMouseMove )
    }

    componentWillUnmount() {
        document.removeEventListener( 'mouseup', this.onMouseUp )
        document.removeEventListener( 'mousemove', this.onMouseMove )
    }

    onMouseDown = (e) => {
        if ( e.button !== 0 ) { // if not left click
            return
        }

        document.addEventListener( 'mouseup', this.onMouseUp )
        document.addEventListener( 'mousemove', this.onMouseMove )

        e.preventDefault()
        e.stopPropagation()

        const { clientX, clientY } = e

        this.setState({
            distance: 0,
            onMouseDownValue: this.props.value,

            prevPointerX: clientX,
            prevPointerY: clientY,
        })
    }

    onMouseMove = e => {

        const {
            clientX, clientY,
            shiftKey: isShiftPressed
        } = e

        const { step, min, max } = this.props
        const {
            distance,
            onMouseDownValue,
            pointerX, pointerY,
            prevPointerX, prevPointerY,
        } = this.state

        const newDistance = distance + (
            ( pointerX - prevPointerX ) -
            ( pointerY - prevPointerY )
        )
        const newValue = onMouseDownValue + (
            newDistance / ( isShiftPressed ? 5 : 50 )
        ) * step

        const computedValue = Math.min( max, Math.max( min, newValue ) )

        this.props.onChange( computedValue )

        this.setState({

            pointerX: clientX,
            pointerY: clientY,

            distance: newDistance,

            prevPointerX: pointerX,
            prevPointerY: pointerY

        })
    }

    onClick = e => e.preventDefault()

    onMouseUp = () => {


        this.inputRef.current.focus()
        this.inputRef.current.select()

        document.removeEventListener( 'mouseup', this.onMouseUp )
        document.removeEventListener( 'mousemove', this.onMouseMove )
    }


    onInputChange = e => {
        this.setState({
            localValue: e.target.value
        })
    }

    onFocus = () => {
        this.setState({
            isSelected: true,
            localValue: this.props.value
        })
    }

    onBlur = () => {
        this.setState({
            isSelected: false,
        })
    }

    onDoubleClick = () => {
        this.inputRef.current.focus()
        this.inputRef.current.select()
    }

    onKeyDown = e => {
        if ( e.key === 'Enter' ) {
            const { localValue } = this.state

            if ( !isNaN( localValue ) ) {
                const value = Number.parseFloat( localValue )
                this.props.onChange( value )
            }

            this.inputRef.current.blur()
        }
    }

    render() {
        const {
            axis,
            precision, min, max, step
        } = this.props

        const formattedValue = this.state.isSelected
                ? this.state.localValue
                : Number(this.props.value).toFixed( precision )

        const hasAxis = Boolean( axis )
        const inputClassName = classNames(
            styles.input,
            !hasAxis && styles.noAxis
        )

        return (
            <div className = { styles.container } >

                {hasAxis && (
                    <div className = { styles.axis } >
                        { axis }
                    </div>
                )}

                <input
                    className = { inputClassName }
                    type = "number"
                    min = { min }
                    max = { max }
                    step = { step }
                    ref = { this.inputRef }

                    value = { formattedValue }
                    onChange = { this.onInputChange }
                    onDoubleClick = { this.onDoubleClick }
                    onKeyDown = { this.onKeyDown }
    
                    onFocus = { this.onFocus }
                    onBlur = { this.onBlur }

                    onMouseDown = { this.onMouseDown }
                    // onMouseUp = { this.onMouseUp }
                    // onMouseMove = { this.onMouseMove }
                />
            </div>
        )
    }
}

NumberInput.defaultProps = defaultProps


/**
 * @typedef { Object } Formatter
 * @property { FormatFunction<number> } format
 * @property { ParseFunction<number> } parse
 */

/**
 * @template T
 * @callback FormatFunction
 * @param { T } value
 * @returns { string }
 */

/**
 * @template T
 * @callback ParseFunction
 * @param { string } value
 * @returns { T }
 */