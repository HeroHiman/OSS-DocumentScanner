<svelte:options accessors />

<script context="module" lang="ts">
    import SettingsSlider from '@shared/components/SettingsSlider.svelte';
    import FolderTextView from './FolderTextView.svelte';
    import { lc } from '@nativescript-community/l';
</script>

<script lang="ts">
    import dayjs from 'dayjs';
    import { parseDateToTimestamp } from '~/utils/dateFilter';
    import { pickDate } from '~/utils/ui';
    import { fonts } from '~/variables';

    export let jpegQuality;
    export let folder;
    export let password;
    export let filename = null;
    export let showFilename = true;
    export let startDate: number = null;
    export let endDate: number = null;

    let startDateInputText = startDate ? dayjs(startDate).format('YYYY-MM-DD') : '';
    let endDateInputText = endDate ? dayjs(endDate).format('YYYY-MM-DD') : '';

    $: DEV_LOG && console.log('jpegQuality', jpegQuality);

    function onFolderSelect(e) {
        folder = e.text;
    }

    function onStartDateTextChange(text: string) {
        startDateInputText = text;
        if (!text || !text.trim()) {
            startDate = null;
            return;
        }
        const ts = parseDateToTimestamp(text);
        if (ts) {
            startDate = ts;
        }
    }

    function onEndDateTextChange(text: string) {
        endDateInputText = text;
        if (!text || !text.trim()) {
            endDate = null;
            return;
        }
        const ts = parseDateToTimestamp(text);
        if (ts) {
            endDate = ts;
        }
    }

    async function selectStartDate() {
        try {
            const date = await pickDate(startDate ? dayjs(startDate) : dayjs());
            if (date) {
                startDate = date;
                startDateInputText = dayjs(date).format('YYYY-MM-DD');
            }
        } catch (error) {
            DEV_LOG && console.log('selectStartDate error', error);
        }
    }

    async function selectEndDate() {
        try {
            const date = await pickDate(endDate ? dayjs(endDate) : dayjs());
            if (date) {
                endDate = date;
                endDateInputText = dayjs(date).format('YYYY-MM-DD');
            }
        } catch (error) {
            DEV_LOG && console.log('selectEndDate error', error);
        }
    }

    function clearDateFilter() {
        startDate = null;
        endDate = null;
        startDateInputText = '';
        endDateInputText = '';
    }
</script>

<gesturerootview padding="10 0 10 0" rows="auto">
    <scrollview height={420}>
        <stacklayout>
            <label class="sectionBigHeader" margin={10} text={lc('export_settings')} />
            <FolderTextView text={folder} on:folder={onFolderSelect} />
            {#if showFilename}
                <textfield
                    autocapitalizationType="none"
                    autocorrect={false}
                    hint={lc('pdf_filename')}
                    margin="5 10 5 10"
                    placeholder={lc('filename')}
                    returnKeyType="next"
                    text={filename}
                    variant="outline"
                    on:textChange={(e) => (filename = e['value'])}
                />
            {/if}
            <SettingsSlider margin="5 10 5 10" max={100} min={0} onChange={(value) => (jpegQuality = value)} step={1} title={lc('jpeg_quality')} value={jpegQuality} />
            <textfield
                autocapitalizationType="none"
                autocorrect={false}
                hint={lc('optional_pdf_password')}
                margin="5 10 5 10"
                placeholder={lc('password')}
                placeholderColor="gray"
                returnKeyType="done"
                secure={true}
                text={password}
                variant="outline"
                on:textChange={(e) => (password = e['value'].length ? e['value'] : null)}
            />

            <!-- Date Range Filter Section with Direct Typing & Calendar Picker -->
            <gridlayout columns="*,auto" margin="10 10 4 10">
                <label col={0} class="sectionHeader" text={lc('filter_by_date')} verticalAlignment="center" />
                {#if startDate || endDate || startDateInputText || endDateInputText}
                    <label col={1} class="icon-btn" text="mdi-close-circle" fontSize={20} color="gray" verticalAlignment="center" on:tap={clearDateFilter} />
                {/if}
            </gridlayout>
            <gridlayout columns="*,*" margin="0 10 10 10">
                <!-- From Date Input -->
                <gridlayout col={0} columns="*,auto" margin="0 4 0 0" padding="4 6" backgroundColor="#00000011" borderRadius={8} verticalAlignment="center">
                    <stacklayout col={0} verticalAlignment="center">
                        <label text={lc('from_date')} fontSize={10} color="gray" />
                        <textfield
                            hint="YYYY-MM-DD"
                            placeholder={lc('any_date')}
                            fontSize={13}
                            padding="0"
                            margin="2 0 0 0"
                            text={startDateInputText}
                            autocorrect={false}
                            autocapitalizationType="none"
                            keyboardType="datetime"
                            on:textChange={(e) => onStartDateTextChange(e['value'])}
                        />
                    </stacklayout>
                    <mdbutton
                        col={1}
                        variant="text"
                        text="mdi-calendar"
                        fontFamily={$fonts.mdi}
                        fontSize={20}
                        width={36}
                        height={36}
                        verticalAlignment="center"
                        on:tap={selectStartDate}
                    />
                </gridlayout>

                <!-- To Date Input -->
                <gridlayout col={1} columns="*,auto" margin="0 0 0 4" padding="4 6" backgroundColor="#00000011" borderRadius={8} verticalAlignment="center">
                    <stacklayout col={0} verticalAlignment="center">
                        <label text={lc('to_date')} fontSize={10} color="gray" />
                        <textfield
                            hint="YYYY-MM-DD"
                            placeholder={lc('any_date')}
                            fontSize={13}
                            padding="0"
                            margin="2 0 0 0"
                            text={endDateInputText}
                            autocorrect={false}
                            autocapitalizationType="none"
                            keyboardType="datetime"
                            on:textChange={(e) => onEndDateTextChange(e['value'])}
                        />
                    </stacklayout>
                    <mdbutton
                        col={1}
                        variant="text"
                        text="mdi-calendar"
                        fontFamily={$fonts.mdi}
                        fontSize={20}
                        width={36}
                        height={36}
                        verticalAlignment="center"
                        on:tap={selectEndDate}
                    />
                </gridlayout>
            </gridlayout>
        </stacklayout>
    </scrollview>
</gesturerootview>
