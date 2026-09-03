<script lang="ts">
    import dayjs, { Dayjs } from 'dayjs';
    import { closeBottomSheet } from '@nativescript-community/ui-material-bottomsheet/svelte';
    import { lc } from '~/helpers/locale';
    import { colors, fonts } from '~/variables';

    let { colorBackground, colorOnBackground, colorOnSurface, colorOnSurfaceVariant, colorOutline, colorPrimary, colorSurface, colorSurfaceContainer } = $colors;
    $: ({ colorBackground, colorOnBackground, colorOnSurface, colorOnSurfaceVariant, colorOutline, colorPrimary, colorSurface, colorSurfaceContainer } = $colors);

    export let date: Dayjs | Date | number = null;

    const initialDate = date ? dayjs(date) : dayjs();

    let viewingYear = initialDate.year();
    let viewingMonth = initialDate.month(); // 0-11

    let selectedYear = initialDate.year();
    let selectedMonth = initialDate.month();
    let selectedDay = initialDate.date();

    let viewMode: 'calendar' | 'year' = 'calendar';

    const weekdays = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

    $: currentMonthYearLabel = dayjs().year(viewingYear).month(viewingMonth).format('MMMM YYYY');
    $: selectedDateFormatted = dayjs().year(selectedYear).month(selectedMonth).date(selectedDay).format('ddd, MMM D, YYYY');

    const currentYear = dayjs().year();
    const yearsList = Array.from({ length: 24 }, (_, i) => currentYear - 12 + i);

    interface CalendarDay {
        key: string;
        day: number;
        month: number;
        year: number;
        row: number;
        col: number;
        isCurrentMonth: boolean;
        isSelected: boolean;
        isToday: boolean;
    }

    let calendarDays: CalendarDay[] = [];

    $: {
        const firstDayOfWeek = new Date(viewingYear, viewingMonth, 1).getDay(); // 0 = Sunday
        const daysInMonth = new Date(viewingYear, viewingMonth + 1, 0).getDate();
        const daysInPrevMonth = new Date(viewingYear, viewingMonth, 0).getDate();

        const days: CalendarDay[] = [];
        const today = dayjs();
        const todayYear = today.year();
        const todayMonth = today.month();
        const todayDay = today.date();

        let row = 0;
        let col = 0;

        // Previous month trailing days
        for (let i = firstDayOfWeek - 1; i >= 0; i--) {
            const d = daysInPrevMonth - i;
            const prevMonth = viewingMonth === 0 ? 11 : viewingMonth - 1;
            const prevYear = viewingMonth === 0 ? viewingYear - 1 : viewingYear;
            const isSelected = selectedYear === prevYear && selectedMonth === prevMonth && selectedDay === d;
            const isToday = todayYear === prevYear && todayMonth === prevMonth && todayDay === d;
            days.push({
                key: `prev-${prevYear}-${prevMonth}-${d}`,
                day: d,
                month: prevMonth,
                year: prevYear,
                row,
                col,
                isCurrentMonth: false,
                isSelected,
                isToday
            });
            col++;
        }

        // Current month days
        for (let d = 1; d <= daysInMonth; d++) {
            const isSelected = selectedYear === viewingYear && selectedMonth === viewingMonth && selectedDay === d;
            const isToday = todayYear === viewingYear && todayMonth === viewingMonth && todayDay === d;
            days.push({
                key: `cur-${viewingYear}-${viewingMonth}-${d}`,
                day: d,
                month: viewingMonth,
                year: viewingYear,
                row,
                col,
                isCurrentMonth: true,
                isSelected,
                isToday
            });
            col++;
            if (col === 7) {
                col = 0;
                row++;
            }
        }

        // Next month leading days to complete the grid
        let nextDay = 1;
        while (col > 0 && col < 7) {
            const nextMonth = viewingMonth === 11 ? 0 : viewingMonth + 1;
            const nextYear = viewingMonth === 11 ? viewingYear + 1 : viewingYear;
            const isSelected = selectedYear === nextYear && selectedMonth === nextMonth && selectedDay === nextDay;
            const isToday = todayYear === nextYear && todayMonth === nextMonth && todayDay === nextDay;
            days.push({
                key: `next-${nextYear}-${nextMonth}-${nextDay}`,
                day: nextDay,
                month: nextMonth,
                year: nextYear,
                row,
                col,
                isCurrentMonth: false,
                isSelected,
                isToday
            });
            nextDay++;
            col++;
        }

        calendarDays = days;
    }

    function prevMonth() {
        if (viewingMonth === 0) {
            viewingMonth = 11;
            viewingYear--;
        } else {
            viewingMonth--;
        }
    }

    function nextMonth() {
        if (viewingMonth === 11) {
            viewingMonth = 0;
            viewingYear++;
        } else {
            viewingMonth++;
        }
    }

    function toggleViewMode() {
        viewMode = viewMode === 'calendar' ? 'year' : 'calendar';
    }

    function selectYear(y: number) {
        viewingYear = y;
        selectedYear = y;
        viewMode = 'calendar';
    }

    function selectDay(d: CalendarDay) {
        selectedYear = d.year;
        selectedMonth = d.month;
        selectedDay = d.day;
        if (!d.isCurrentMonth) {
            viewingYear = d.year;
            viewingMonth = d.month;
        }
    }

    function onToday() {
        const now = dayjs();
        viewingYear = now.year();
        viewingMonth = now.month();
        selectedYear = now.year();
        selectedMonth = now.month();
        selectedDay = now.date();
        viewMode = 'calendar';
    }

    function onCancel() {
        closeBottomSheet(null);
    }

    function onConfirm() {
        const result = dayjs().year(selectedYear).month(selectedMonth).date(selectedDay).startOf('day').valueOf();
        closeBottomSheet(result);
    }
</script>

<gesturerootview rows="auto">
    <gridlayout rows="auto,auto,auto,auto" padding="16 16 20 16" backgroundColor={colorSurface}>
        <!-- Top header: Navigation & Selected date -->
        <gridlayout row={0} columns="auto,*,auto" verticalAlignment="center" margin="0 0 16 0">
            <mdbutton
                col={0}
                variant="text"
                text="mdi-chevron-left"
                fontFamily={$fonts.mdi}
                fontSize={24}
                width={44}
                height={44}
                on:tap={prevMonth}
            />
            <stacklayout col={1} horizontalAlignment="center" verticalAlignment="center" on:tap={toggleViewMode}>
                <label
                    text={currentMonthYearLabel}
                    fontSize={17}
                    fontWeight="bold"
                    color={colorOnSurface}
                    horizontalAlignment="center"
                />
                <label
                    text={selectedDateFormatted}
                    fontSize={12}
                    color={colorPrimary}
                    horizontalAlignment="center"
                    margin="2 0 0 0"
                />
            </stacklayout>
            <mdbutton
                col={2}
                variant="text"
                text="mdi-chevron-right"
                fontFamily={$fonts.mdi}
                fontSize={24}
                width={44}
                height={44}
                on:tap={nextMonth}
            />
        </gridlayout>

        <!-- View Mode 1: Calendar Grid -->
        {#if viewMode === 'calendar'}
            <!-- Weekday headers -->
            <gridlayout row={1} columns="*,*,*,*,*,*,*" margin="0 0 8 0">
                {#each weekdays as w, i}
                    <label
                        col={i}
                        text={w}
                        fontSize={12}
                        fontWeight="bold"
                        color={colorOnSurfaceVariant}
                        horizontalAlignment="center"
                    />
                {/each}
            </gridlayout>

            <!-- Calendar Month Days -->
            <gridlayout row={2} columns="*,*,*,*,*,*,*" rows="auto,auto,auto,auto,auto,auto">
                {#each calendarDays as d (d.key)}
                    <gridlayout
                        col={d.col}
                        row={d.row}
                        width={38}
                        height={38}
                        borderRadius={19}
                        backgroundColor={d.isSelected ? colorPrimary : 'transparent'}
                        horizontalAlignment="center"
                        verticalAlignment="center"
                        opacity={d.isCurrentMonth ? 1 : 0.3}
                        margin="2"
                        on:tap={() => selectDay(d)}
                    >
                        <label
                            text={`${d.day}`}
                            fontSize={14}
                            fontWeight={d.isSelected ? 'bold' : (d.isToday ? 'bold' : 'normal')}
                            color={d.isSelected ? '#ffffff' : (d.isToday ? colorPrimary : colorOnSurface)}
                            horizontalAlignment="center"
                            verticalAlignment="center"
                        />
                        {#if d.isToday && !d.isSelected}
                            <label
                                text="•"
                                fontSize={10}
                                color={colorPrimary}
                                horizontalAlignment="center"
                                verticalAlignment="bottom"
                                margin="0 0 2 0"
                            />
                        {/if}
                    </gridlayout>
                {/each}
            </gridlayout>
        {:else}
            <!-- View Mode 2: Year Selector Grid -->
            <gridlayout row={2} columns="*,*,*,*" rows="auto,auto,auto,auto,auto,auto" height={220} margin="8 0">
                {#each yearsList as y, idx (y)}
                    <gridlayout
                        col={idx % 4}
                        row={Math.floor(idx / 4)}
                        padding="6 10"
                        borderRadius={8}
                        backgroundColor={y === viewingYear ? colorPrimary : 'transparent'}
                        horizontalAlignment="center"
                        verticalAlignment="center"
                        margin="4"
                        on:tap={() => selectYear(y)}
                    >
                        <label
                            text={`${y}`}
                            fontSize={14}
                            fontWeight={y === viewingYear ? 'bold' : 'normal'}
                            color={y === viewingYear ? '#ffffff' : colorOnSurface}
                            horizontalAlignment="center"
                        />
                    </gridlayout>
                {/each}
            </gridlayout>
        {/if}

        <!-- Bottom Action Buttons -->
        <gridlayout row={3} columns="auto,*,auto,auto" margin="16 0 0 0" verticalAlignment="center">
            <mdbutton col={0} variant="text" text={lc('cancel')} on:tap={onCancel} />
            <mdbutton col={2} variant="text" text={lc('today')} on:tap={onToday} />
            <mdbutton col={3} variant="contained" text={lc('ok')} on:tap={onConfirm} />
        </gridlayout>
    </gridlayout>
</gesturerootview>
